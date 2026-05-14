import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// SVG Icons with stroke colors
const icons = {
    dir: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23eff6ff" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
    default: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23f0fdf4" stroke="%2310b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    js: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23fefce8" stroke="%23eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><text x="8" y="16" font-family="sans-serif" font-weight="bold" font-size="6" fill="%23eab308" stroke="none">JS</text></svg>`,
    ts: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23eff6ff" stroke="%232563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><text x="8" y="16" font-family="sans-serif" font-weight="bold" font-size="6" fill="%232563eb" stroke="none">TS</text></svg>`,
    react: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23ecfeff" stroke="%2306b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="1"/><ellipse cx="12" cy="15" rx="4" ry="1.5" transform="rotate(30 12 15)"/><ellipse cx="12" cy="15" rx="4" ry="1.5" transform="rotate(90 12 15)"/><ellipse cx="12" cy="15" rx="4" ry="1.5" transform="rotate(150 12 15)"/></svg>`,
    py: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23f0f9ff" stroke="%230284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="16" font-family="sans-serif" font-weight="bold" font-size="6" fill="%230284c7" stroke="none">PY</text></svg>`,
};

const iconCache = {};
Object.entries(icons).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    iconCache[key] = img;
});

const getFileIcon = (filename) => {
    if (!filename.includes('.')) return iconCache.default;
    const ext = filename.split('.').pop().toLowerCase();
    if (['js'].includes(ext)) return iconCache.js;
    if (['ts'].includes(ext)) return iconCache.ts;
    if (['jsx', 'tsx'].includes(ext)) return iconCache.react;
    if (['py'].includes(ext)) return iconCache.py;
    return iconCache.default;
};

const GraphView = ({ data, onNodeClick }) => {
    const graphRef = useRef();

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current.d3Force('charge').strength(-300);
            graphRef.current.d3Force('link').distance(80);
        }
    }, [data]);

    return (
        <div className="main-content">
            <ForceGraph2D
                ref={graphRef}
                graphData={data}
                nodeLabel="label"
                nodeRelSize={6}
                linkColor={() => 'rgba(0, 0, 0, 0.1)'}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={1.5}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleColor={() => 'rgba(59, 130, 246, 0.5)'}
                onNodeClick={onNodeClick}
                backgroundColor="#f8fafc"
                nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = node.label;
                    const fontSize = 12 / globalScale;
                    ctx.font = `400 ${fontSize}px Outfit, sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth + 8 / globalScale, fontSize + 4 / globalScale];

                    // Draw Icon
                    const img = node.type === 'dir' ? iconCache.dir : getFileIcon(label);
                    const size = node.size || 12; // Dynamic size from backend
                    
                    if (img && img.complete) {
                        ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
                    } else {
                        // Fallback circle
                        ctx.fillStyle = node.type === 'dir' ? '#3b82f6' : '#10b981';
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
                        ctx.fill();
                    }

                    // Draw Label Background (Pill)
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.roundRect(
                        node.x - bckgDimensions[0] / 2, 
                        node.y + size / 2 + 4 / globalScale, 
                        bckgDimensions[0], 
                        bckgDimensions[1], 
                        4 / globalScale
                    );
                    ctx.fill();
                    ctx.shadowBlur = 0; // reset shadow

                    // Draw Label Text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#1e293b'; // Classic dark text
                    ctx.fillText(label, node.x, node.y + size / 2 + 4 / globalScale + bckgDimensions[1] / 2);
                }}
            />
        </div>
    );
};

export default GraphView;
