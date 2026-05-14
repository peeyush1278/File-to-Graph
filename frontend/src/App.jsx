import React, { useState } from 'react';
import axios from 'axios';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import { Upload, FileCode2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function App() {
    const [graphData, setGraphData] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [analysis, setAnalysis] = useState('');
    const [suggestions, setSuggestions] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);

    // Poll for backend status
    React.useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const response = await axios.get(`${API_BASE}/status`);
                setIsBusy(response.data.isBusy);
            } catch (e) {
                console.error('Status check failed');
            }
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (!files.length) return;

        setUploading(true);
        const formData = new FormData();
        const skipDirs = ['node_modules', '.git', '__pycache__', 'venv', 'env', '.venv', 'dist', 'build', '.next', '.vscode', '.idea', 'coverage', '.cache'];
        const skipFiles = ['.env', '.env.local', '.gitignore', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Thumbs.db', '.DS_Store'];

        let addedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const path = file.webkitRelativePath || file.name;
            const parts = path.replace(/\\/g, '/').split('/');
            
            const shouldSkip = parts.some(part => skipDirs.includes(part.toLowerCase()));
            const basename = parts[parts.length - 1];
            const isSkipFile = skipFiles.includes(basename);

            if (!shouldSkip && !isSkipFile) {
                formData.append('files', file, path);
                addedCount++;
            }
        }

        if (addedCount === 0) {
            alert('No valid files to upload after filtering.');
            setUploading(false);
            return;
        }

        try {
            const response = await axios.post(`${API_BASE}/upload`, formData);
            setGraphData(response.data);
            setUploading(false);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload files. Check if backend is running.');
            setUploading(false);
        }
    };

    const handleNodeClick = async (node) => {
        if (isBusy) {
            alert('A model is already running. Please wait.');
            return;
        }
        setSelectedNode(node);
        if (node.type === 'file') {
            setLoading(true);
            try {
                const response = await axios.post(`${API_BASE}/analyze`, { nodeId: node.id });
                setAnalysis(response.data.analysis);
            } catch (error) {
                setAnalysis(error.response?.data?.error || 'Error analyzing file.');
            }
            setLoading(false);
        } else {
            setAnalysis('');
        }
    };

    const handleGetSuggestions = async () => {
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE}/suggest`);
            setSuggestions(response.data.suggestions);
        } catch (error) {
            setSuggestions(error.response?.data?.error || 'Error getting suggestions.');
        }
        setLoading(false);
    };

    const handleChatQuery = async (query) => {
        if (!query.trim()) return;
        
        const newMessage = { role: 'user', content: query };
        setChatMessages(prev => [...prev, newMessage]);
        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE}/query`, { query });
            setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.answer }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: error.response?.data?.error || 'Error processing query.' }]);
        }
        setLoading(false);
    };

    const handleReset = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/clear`);
        } catch (error) {
            console.error('Error clearing backend state:', error);
        }
        setGraphData(null);
        setSelectedNode(null);
        setAnalysis('');
        setSuggestions('');
        setChatMessages([]);
        setLoading(false);
    };

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--bg-main)' }}>
            <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 100, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode2 color="#6366f1" size={24} />
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.5px' }}>FileToGraph</h1>
                </div>
                {isBusy && (
                    <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                        <div className="loader" style={{ width: '12px', height: '12px' }}></div>
                        <span style={{ fontSize: '0.9rem' }}>Model Running...</span>
                    </div>
                )}
                {graphData && (
                    <button 
                        className="glass" 
                        onClick={handleReset}
                        style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(99, 102, 241, 0.15)', color: 'white', borderRadius: '8px' }}
                    >
                        <Upload size={16} />
                        Change Folder
                    </button>
                )}
            </div>

            {!graphData && !uploading && (
                <div className="upload-area glass">
                    <Upload size={48} color="#6366f1" style={{ marginBottom: '20px' }} />
                    <h2 style={{ marginBottom: '10px' }}>Upload Your Project</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                        Visualize your codebase and get AI-powered insights.
                    </p>
                    <label className="btn-primary" style={{ cursor: 'pointer' }}>
                        Select Files / Folder
                        <input 
                            type="file" 
                            multiple 
                            webkitdirectory="true" 
                            directory="true" 
                            onChange={handleFileUpload} 
                            style={{ display: 'none' }} 
                        />
                    </label>
                </div>
            )}

            {uploading && (
                <div className="upload-area">
                    <div className="loader" style={{ width: '48px', height: '48px', marginBottom: '20px' }}></div>
                    <p>Parsing project structure & generating embeddings...</p>
                </div>
            )}

            {graphData && (
                <>
                    <GraphView data={graphData} onNodeClick={handleNodeClick} />
                    <Sidebar 
                        selectedNode={selectedNode} 
                        analysis={analysis} 
                        suggestions={suggestions}
                        loading={loading || isBusy}
                        onGetSuggestions={handleGetSuggestions}
                        chatMessages={chatMessages}
                        onSendMessage={handleChatQuery}
                    />
                </>
            )}
        </div>
    );
}

export default App;
