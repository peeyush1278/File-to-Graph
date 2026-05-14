import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, Sparkles, X, Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ selectedNode, analysis, suggestions, loading, onGetSuggestions, chatMessages, onSendMessage }) => {
    const [query, setQuery] = useState('');
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const handleSend = () => {
        if (query.trim() && !loading) {
            onSendMessage(query);
            setQuery('');
        }
    };

    return (
        <motion.div 
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            className="sidebar glass"
            style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Insights & Chat</h2>
                <Sparkles className="text-accent" size={20} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* File Analysis Section */}
                <div className="section-container">
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        File Details
                    </h3>
                    <AnimatePresence mode="wait">
                        {selectedNode ? (
                            <motion.div
                                key={selectedNode.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                    {selectedNode.type === 'dir' ? <Folder color="var(--accent-color)" /> : <FileText color="#10b981" />}
                                    <span style={{ fontWeight: 600 }}>{selectedNode.label}</span>
                                </div>

                                <div className="markdown-content" style={{ fontSize: '14px' }}>
                                    {analysis ? (
                                        <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>') }} />
                                    ) : (
                                        <p style={{ color: 'var(--text-secondary)' }}>
                                            {selectedNode.type === 'file' ? 'Analyzing file...' : 'Select a file for analysis.'}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                Select a node on the graph to begin.
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Chat Section */}
                <div className="section-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Query Bot (RAG)
                    </h3>
                    <div className="chat-container glass" style={{ flex: 1, overflowY: 'auto', padding: '10px', marginBottom: '10px', maxHeight: '400px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.03)' }}>
                        {chatMessages.length === 0 && (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', marginTop: '20px' }}>
                                Ask anything about your codebase...
                            </p>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                {msg.role === 'assistant' && <Bot size={16} color="var(--accent-color)" style={{ marginTop: '4px' }} />}
                                <div style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: '12px', 
                                    maxWidth: '80%', 
                                    fontSize: '13px',
                                    background: msg.role === 'user' ? 'var(--accent-color)' : 'rgba(0,0,0,0.05)',
                                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)'
                                }}>
                                    {msg.content}
                                </div>
                                {msg.role === 'user' && <User size={16} color="#10b981" style={{ marginTop: '4px' }} />}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            className="glass"
                            placeholder={loading ? "Model busy..." : "Type your query..."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            disabled={loading}
                            style={{ flex: 1, padding: '10px', fontSize: '14px', outline: 'none' }}
                        />
                        <button 
                            className="btn-primary" 
                            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={handleSend}
                            disabled={loading || !query.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button 
                    className="btn-primary" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={onGetSuggestions}
                    disabled={loading}
                >
                    <Sparkles size={16} />
                    Folder Recommendations
                </button>
                
                {suggestions && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        style={{ marginTop: '20px', fontSize: '13px', maxHeight: '150px', overflowY: 'auto' }}
                        className="markdown-content"
                    >
                        <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>AI Advice</h4>
                        <div dangerouslySetInnerHTML={{ __html: suggestions.replace(/\n/g, '<br/>') }} />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default Sidebar;
