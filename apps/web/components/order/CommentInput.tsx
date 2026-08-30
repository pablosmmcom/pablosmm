"use client";
import React, { useState, useRef, useEffect } from 'react';
import { lightImpact, selectionTick } from '@/lib/haptics';

interface CommentInputProps {
    targetQuantity: number;
    comments: string[];
    setComments: (comments: string[]) => void;
    className?: string;
}

const CommentInput: React.FC<CommentInputProps> = ({
    targetQuantity,
    comments,
    setComments,
    className = ""
}) => {
    const [inputValue, setInputValue] = useState("");
    const [view, setView] = useState<'chat' | 'bulk'>('chat');
    const [bulkText, setBulkText] = useState(comments.join('\n'));
    const isInternalBulkChange = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Sync bulkText only when comments change externally (e.g. initial load, chat view adds, smart fill)
    useEffect(() => {
        if (isInternalBulkChange.current) {
            isInternalBulkChange.current = false;
            return;
        }
        setBulkText(comments.join('\n'));
    }, [comments]);

    // Sync scroll to bottom in chat view
    useEffect(() => {
        if (view === 'chat' && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments, view]);

    const handleAddComment = () => {
        if (!inputValue.trim()) return;
        const newComments = [...comments, inputValue.trim()];
        setComments(newComments);
        setInputValue("");
        lightImpact();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddComment();
        }
    };

    const removeComment = (index: number) => {
        const newComments = comments.filter((_, i) => i !== index);
        setComments(newComments);
        selectionTick();
    };

    const handleBulkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        isInternalBulkChange.current = true;
        setBulkText(val);
        const lines = val.split('\n').map(l => l.trim()).filter(l => l !== "");
        setComments(lines);
    };

    const smartLoop = () => {
        if (comments.length === 0) return;
        let newComments = [...comments];
        while (newComments.length < targetQuantity) {
            // Loop the existing comments
            newComments = [...newComments, ...comments].slice(0, targetQuantity);
        }
        setComments(newComments);
        setBulkText(newComments.join('\n'));
        lightImpact();
    };

    const remaining = Math.max(0, targetQuantity - comments.length);

    return (
        <div className={`comment-input-container ${className}`}>
            <div className="comment-header">
                <div className="header-info">
                    <span className="count">{comments.length} / {targetQuantity}</span>
                    <span className="label">comments added</span>
                </div>
                <div className="view-toggle">
                    <button
                        className={view === 'chat' ? 'active' : ''}
                        onClick={() => {
                            setView('chat');
                        }}
                    >
                        Chat
                    </button>
                    <button
                        className={view === 'bulk' ? 'active' : ''}
                        onClick={() => {
                            setView('bulk');
                            setBulkText(comments.join('\n'));
                        }}
                    >
                        Bulk
                    </button>
                </div>
            </div>

            <div className="comment-content">
                {view === 'chat' ? (
                    <div className="chat-view" ref={scrollRef}>
                        {comments.length === 0 ? (
                            <div className="empty-state">No comments added yet</div>
                        ) : (
                            comments.map((c, i) => (
                                <div key={i} className="comment-bubble">
                                    <span className="text">{c}</span>
                                    <button className="remove" onClick={() => removeComment(i)}>×</button>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <textarea
                        className="bulk-textarea"
                        placeholder="One comment per line..."
                        value={bulkText}
                        onChange={handleBulkChange}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                )}
            </div>

            <div className="comment-footer">
                {view === 'chat' && (
                    <div className="messageBox">
                        <div className="file_upload_icon" title="Bulk Import (Coming Soon)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </div>
                        <input
                            placeholder="Type a comment..."
                            type="text"
                            className="messageInput"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button className="sendButton" onClick={handleAddComment}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                )}

                {remaining > 0 && comments.length > 0 && (
                    <button className="smart-loop-btn" onClick={smartLoop}>
                        <span className="sparkle">✨</span> Smart Fill ({remaining} more)
                    </button>
                )}
            </div>
        </div>
    );
};

export default CommentInput;
