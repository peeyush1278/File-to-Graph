const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const OLLAMA_GENERATE_URL = 'http://localhost:11434/api/generate';
const OLLAMA_EMBED_URL = 'http://localhost:11434/api/embeddings';
const ANALYZE_MODEL = 'phi4-mini:latest';
const CHAT_MODEL = 'phi4-mini:latest';

let isModelRunning = false;
let currentFiles = [];
let fileEmbeddings = [];
let currentJobId = 0;

// Helper to manage model lock
const withLock = async (callback) => {
    if (isModelRunning) {
        throw new Error('Another model is already running. Please wait.');
    }
    isModelRunning = true;
    try {
        return await callback();
    } finally {
        isModelRunning = false;
    }
};

// Cosine similarity helper
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const skipDirs = ['node_modules', '.git', '__pycache__', 'venv', 'env', '.venv', 'dist', 'build', '.next', '.vscode', '.idea', 'coverage', '.cache'];
const skipFiles = ['.env', '.env.local', '.gitignore', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Thumbs.db', '.DS_Store'];

const shouldSkip = (originalname) => {
    const normalizedPath = originalname.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    if (parts.some(part => skipDirs.includes(part.toLowerCase()))) return true;
    const basename = parts[parts.length - 1];
    if (skipFiles.includes(basename)) return true;
    return false;
};

const SUMMARIES_FILE = path.join(__dirname, 'summaries.json');
let summariesCache = {};
if (fs.existsSync(SUMMARIES_FILE)) {
    try {
        summariesCache = JSON.parse(fs.readFileSync(SUMMARIES_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading summaries cache:", e);
    }
}

const saveSummaries = () => {
    fs.writeFileSync(SUMMARIES_FILE, JSON.stringify(summariesCache, null, 2));
};

// Helper to build graph from file paths
function buildGraph(files) {
    const nodes = [{ id: 'root', label: 'root', type: 'dir', size: 16 }];
    const links = [];
    const seenNodes = new Set(['root']);

    files.forEach(file => {
        if (shouldSkip(file.originalname)) return;
        
        const parts = file.originalname.replace(/\\/g, '/').split('/');
        let currentPath = 'root';

        parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            const nodePath = parts.slice(0, index + 1).join('/');
            const nodeId = `root/${nodePath}`;

            if (!seenNodes.has(nodeId)) {
                nodes.push({
                    id: nodeId,
                    label: part,
                    type: isLast ? 'file' : 'dir',
                    size: isLast ? Math.max(12, Math.log10(file.size + 1) * 6) : 16
                });
                links.push({ source: currentPath, target: nodeId });
                seenNodes.add(nodeId);
            }
            currentPath = nodeId;
        });
    });

    return { nodes, links };
}

app.get('/api/status', (req, res) => {
    res.json({ isBusy: isModelRunning });
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        currentFiles = req.files;
        const graph = buildGraph(req.files);
        
        // Background task: Generate embeddings for RAG
        currentJobId++;
        const jobId = currentJobId;
        generateAllEmbeddings(req.files, jobId).catch(err => console.error('Background Embedding error:', err));

        res.json(graph);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process files: ' + error.message });
    }
});

app.post('/api/clear', (req, res) => {
    currentJobId++; // Cancel any ongoing job
    currentFiles = [];
    fileEmbeddings = [];
    res.json({ success: true });
});

async function generateAllEmbeddings(files, jobId) {
    fileEmbeddings = [];
    const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.html', '.css', '.md', '.txt', '.json'];
    
    for (const file of files) {
        if (currentJobId !== jobId) {
            console.log('Background embedding job cancelled for previous folder.');
            break;
        }
        if (shouldSkip(file.originalname)) continue;
        
        const ext = path.extname(file.originalname).toLowerCase();
        if (!textExtensions.includes(ext)) continue;
        if (file.size > 20000) continue; // Skip larger files for faster processing

        // Get file signature (name + size) to invalidate cache if file changes
        const fileKey = `${file.originalname}_${file.size}`;
        let fileSummary = summariesCache[fileKey];

        let success = false;
        while (!success) {
            if (isModelRunning) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            try {
                await withLock(async () => {
                    // 1. Generate Summary if not cached
                    if (!fileSummary) {
                        const contentToSummarize = file.buffer.toString().substring(0, 3000);
                        const prompt = `Summarize this file concisely (max 2 sentences) focusing on its main purpose:\n\nFile: ${file.originalname}\n\`\`\`\n${contentToSummarize}\n\`\`\``;
                        
                        const summaryRes = await axios.post(OLLAMA_GENERATE_URL, {
                            model: ANALYZE_MODEL,
                            prompt: prompt,
                            stream: false
                        }, { timeout: 300000 });
                        fileSummary = summaryRes.data.response;
                        summariesCache[fileKey] = fileSummary;
                        saveSummaries(); // Persistent save
                    }

                    // 2. Embed the Summary instead of raw code
                    const response = await axios.post(OLLAMA_EMBED_URL, {
                        model: ANALYZE_MODEL,
                        input: `File: ${file.originalname}\nSummary: ${fileSummary}`
                    }, { timeout: 300000 });
                    
                    if (response.data && response.data.embedding) {
                        fileEmbeddings.push({
                            name: file.originalname,
                            embedding: response.data.embedding,
                            content: file.buffer.toString(),
                            summary: fileSummary
                        });
                    }
                });
                success = true;
            } catch (e) {
                if (e.message.includes('running')) {
                    // Another request snuck in, wait and retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error(`Failed to process ${file.originalname}:`, e.message);
                    success = true; // Break loop on actual API error (500, etc)
                }
            }
        }
    }
    console.log(`Generated embeddings for ${fileEmbeddings.length} files.`);
}

app.post('/api/analyze', async (req, res) => {
    const { nodeId } = req.body;
    const file = currentFiles.find(f => `root/${f.originalname}` === nodeId);

    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const result = await withLock(async () => {
            const prompt = `You are a professional code analyzer. Provide a concise summary of the following code file and suggest improvements.
    
File: ${file.originalname}
Content:
\`\`\`
${file.buffer.toString()}
\`\`\`

Format your response as:
Summary: [brief summary]
Improvements: [bullet points]`;

            const response = await axios.post(OLLAMA_GENERATE_URL, {
                model: ANALYZE_MODEL,
                prompt: prompt,
                stream: false
            }, { timeout: 300000 });
            return response.data.response;
        });
        res.json({ analysis: result });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(error.message.includes('running') ? 429 : 500).json({ error: error.message });
    }
});

app.post('/api/suggest', async (req, res) => {
    const fileList = currentFiles.map(f => f.originalname).join('\n');

    try {
        const result = await withLock(async () => {
            const prompt = `Based on the following file structure, suggest how to better organize this folder or what missing files/folders might be needed for a professional project structure.

Files:
${fileList}

Provide actionable suggestions.`;

            const response = await axios.post(OLLAMA_GENERATE_URL, {
                model: ANALYZE_MODEL,
                prompt: prompt,
                stream: false
            }, { timeout: 300000 });
            return response.data.response;
        });
        res.json({ suggestions: result });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(error.message.includes('running') ? 429 : 500).json({ error: error.message });
    }
});

app.post('/api/query', async (req, res) => {
    const { query } = req.body;

    try {
        const result = await withLock(async () => {
            // 1. Embed query
            const embedRes = await axios.post(OLLAMA_EMBED_URL, {
                model: ANALYZE_MODEL,
                input: query
            });
            const queryVector = embedRes.data.embedding;

            // 2. Find top 3 relevant files
            const scores = fileEmbeddings.map(f => ({
                name: f.name,
                content: f.content,
                summary: f.summary,
                score: cosineSimilarity(queryVector, f.embedding)
            })).sort((a, b) => b.score - a.score).slice(0, 3);

            const context = scores.map(f => `File: ${f.name}\nSummary: ${f.summary}\nContent snippet:\n${f.content.substring(0, 1500)}`).join('\n\n---\n\n');

            // 3. Generate answer with CHAT_MODEL
            const prompt = `You are an AI assistant helping a developer understand their codebase. Use the following context (file summaries and content snippets) to answer their query.
            
Context:
${context}

User Query: ${query}

Provide a helpful, accurate, and concise answer.`;

            const response = await axios.post(OLLAMA_GENERATE_URL, {
                model: CHAT_MODEL,
                prompt: prompt,
                stream: false
            }, { timeout: 300000 });
            return response.data.response;
        });
        res.json({ answer: result });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(error.message.includes('running') ? 429 : 500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});
