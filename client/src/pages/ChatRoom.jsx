import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket, API_URL } from '../socket';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function ChatRoom() {
    const { roomCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const addToast = useToast();

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [myAnonId, setMyAnonId] = useState('');
    const [myColor, setMyColor] = useState('#FFFFFF');
    const [users, setUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [deliveredMessages, setDeliveredMessages] = useState(new Set());

    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);

    const internalId = location.state?.internalId;
    const isGhost = location.state?.isGhost;

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (!internalId) {
            addToast('Invalid room access. Please join through a valid code.', 'error');
            navigate('/');
            return;
        }

        const socket = connectSocket();
        socketRef.current = socket;

        socket.emit('join-room', { roomInternalId: internalId, isGhost });

        socket.on('joined', (data) => {
            setMyAnonId(data.anonId);
            setMyColor(data.color);
            setUsers(data.users || []);
            setIsConnected(true);
        });

        socket.on('new-message', (msg) => {
            setMessages(prev => [...prev, { type: 'message', ...msg }]);
        });

        socket.on('message-delivered', ({ messageId }) => {
            setDeliveredMessages(prev => new Set([...prev, messageId]));
        });

        socket.on('user-joined', ({ anonId, color }) => {
            setMessages(prev => [...prev, { type: 'system', text: `${anonId} joined the room`, timestamp: new Date().toISOString() }]);
        });

        socket.on('user-left', ({ anonId }) => {
            setMessages(prev => [...prev, { type: 'system', text: `${anonId} left the room`, timestamp: new Date().toISOString() }]);
        });

        socket.on('user-list', (userList) => {
            setUsers(userList);
        });

        socket.on('user-typing', ({ anonId, isTyping }) => {
            setTypingUsers(prev => {
                if (isTyping && !prev.includes(anonId)) return [...prev, anonId];
                if (!isTyping) return prev.filter(u => u !== anonId);
                return prev;
            });
        });

        socket.on('security-warning', ({ message }) => {
            setMessages(prev => [...prev, { type: 'warning', text: message, timestamp: new Date().toISOString() }]);
        });

        socket.on('room-closed', ({ message }) => {
            addToast(message, 'error');
            navigate('/');
        });

        socket.on('error', ({ message }) => {
            addToast(message, 'error');
            navigate('/');
        });

        // Security: screenshot detection
        function handleKeyDown(e) {
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                socket.emit('screenshot-attempt');
            }
        }

        // Security: prevent copy/paste
        function handleCopy(e) { e.preventDefault(); }
        function handlePaste(e) { e.preventDefault(); }
        function handleContextMenu(e) { e.preventDefault(); }

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            socket.emit('leave-room');
            socket.off('joined');
            socket.off('new-message');
            socket.off('message-delivered');
            socket.off('user-joined');
            socket.off('user-left');
            socket.off('user-list');
            socket.off('user-typing');
            socket.off('security-warning');
            socket.off('room-closed');
            socket.off('error');
            disconnectSocket();
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [internalId, isGhost, navigate, addToast]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    function handleSend() {
        if (!inputText.trim() || !socketRef.current || isGhost) return;
        socketRef.current.emit('send-message', { message: inputText.trim() });
        setInputText('');
        // Clear typing indicator
        socketRef.current.emit('typing', { isTyping: false });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    function handleInputChange(e) {
        setInputText(e.target.value);
        if (socketRef.current && !isGhost) {
            socketRef.current.emit('typing', { isTyping: true });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current?.emit('typing', { isTyping: false });
            }, 2000);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleLeave() {
        // Purge local data
        try {
            localStorage.clear();
            sessionStorage.clear();
            if (window.indexedDB) {
                const dbs = window.indexedDB.databases?.();
                if (dbs) dbs.then(databases => databases.forEach(db => window.indexedDB.deleteDatabase(db.name)));
            }
        } catch (_) { /* silent */ }

        setShowLeaveModal(false);
        navigate('/');
    }

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    }

    return (
        <div className="chat-container no-select">
            <div className="chat-header">
                <div className="chat-header-info">
                    <span className="room-code">{roomCode}</span>
                    <span className="user-count">
                        <span className="dot" />
                        {users.length} online
                    </span>
                    {isGhost && <span style={{ fontSize: '0.75rem', color: 'var(--accent-warning)', marginLeft: 8 }}>👻 Ghost Mode</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        You are <span style={{ color: myColor, fontWeight: 600 }}>{myAnonId}</span>
                    </span>
                    <button id="btn-leave-room" className="btn btn-danger btn-sm" onClick={() => setShowLeaveModal(true)}>
                        Leave Room
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div className="chat-messages">
                    {messages.map((msg, i) => {
                        if (msg.type === 'system') {
                            return <div key={i} className="system-message">{msg.text}</div>;
                        }
                        if (msg.type === 'warning') {
                            return <div key={i} className="system-message warning">{msg.text}</div>;
                        }
                        const isOwn = msg.anonId === myAnonId;
                        return (
                            <div key={msg.id || i} className={`message ${isOwn ? 'own' : 'other'}`}>
                                <div className="message-header">
                                    <span className="message-sender" style={{ color: msg.color }}>{msg.anonId}</span>
                                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                                </div>
                                <div className="message-bubble">
                                    {msg.message}
                                </div>
                                {isOwn && deliveredMessages.has(msg.id) && (
                                    <div className="message-receipt">✅</div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-users-sidebar">
                    <h4>Online — {users.length}</h4>
                    {users.map((user, i) => (
                        <div key={i} className="user-list-item">
                            <span className="user-dot" style={{ background: user.color }} />
                            <span style={{ color: user.color }}>{user.anonId}</span>
                            {user.anonId === myAnonId && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(you)</span>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="typing-indicator">
                {typingUsers.length > 0 && (
                    <>
                        <div className="typing-dots">
                            <span /><span /><span />
                        </div>
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </>
                )}
            </div>

            {!isGhost && (
                <div className="chat-input-area">
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onCopy={e => e.preventDefault()}
                            onPaste={e => e.preventDefault()}
                            placeholder="Type a message..."
                            rows={1}
                        />
                        <button className="btn-send" onClick={handleSend} disabled={!inputText.trim()}>
                            ➤
                        </button>
                    </div>
                </div>
            )}

            {/* Leave Confirmation Modal */}
            <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)}>
                <div className="modal-header">
                    <h2>Leave Room?</h2>
                </div>
                <div className="modal-body">
                    <div className="leave-confirm-icon">🔒</div>
                    <p className="leave-confirm-text">
                        All messages will be erased from your device.<br />
                        No trace will remain for others.<br />
                        <strong>This action cannot be undone.</strong>
                    </p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => setShowLeaveModal(false)}>Stay</button>
                    <button className="btn btn-danger" onClick={handleLeave}>
                        Leave & Purge Data
                    </button>
                </div>
            </Modal>
        </div>
    );
}
