import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { API_URL } from '../socket';

export default function HomePage() {
    const navigate = useNavigate();
    const addToast = useToast();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

    // Create room state
    const [createdRoom, setCreatedRoom] = useState(null);
    const [usePassword, setUsePassword] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [showQR, setShowQR] = useState(false);
    const [creating, setCreating] = useState(false);

    // Join room state
    const [joinCode, setJoinCode] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [joinRoomData, setJoinRoomData] = useState(null);
    const [joining, setJoining] = useState(false);

    // Code refresh timer
    const [codeTimer, setCodeTimer] = useState(15);
    const codeTimerRef = useRef(null);

    // Clean up timer when modal closes or component unmounts
    useEffect(() => {
        return () => {
            if (codeTimerRef.current) {
                clearInterval(codeTimerRef.current);
                codeTimerRef.current = null;
            }
        };
    }, []);

    function cleanupCreateModal() {
        if (codeTimerRef.current) {
            clearInterval(codeTimerRef.current);
            codeTimerRef.current = null;
        }
        setShowCreateModal(false);
        setCreatedRoom(null);
        setShowQR(false);
        setUsePassword(false);
        setRoomPassword('');
        setCodeTimer(15);
    }

    async function handleCreateRoom() {
        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: usePassword ? roomPassword : null })
            });
            const data = await res.json();
            if (data.success) {
                setCreatedRoom(data);
                addToast('Room Created Successfully. Share the Code or Invite Link.', 'success');
                startCodeRefreshTimer(data.internalId);
            }
        } catch (err) {
            addToast('Failed to create room', 'error');
        }
        setCreating(false);
    }

    function startCodeRefreshTimer(internalId) {
        // Clear any existing timer
        if (codeTimerRef.current) {
            clearInterval(codeTimerRef.current);
        }

        let seconds = 15;
        setCodeTimer(seconds);
        codeTimerRef.current = setInterval(async () => {
            seconds--;
            setCodeTimer(seconds);
            if (seconds <= 0) {
                try {
                    const res = await fetch(`${API_URL}/api/rooms/${internalId}/refresh-code`, {
                        method: 'POST'
                    });
                    const data = await res.json();
                    if (data.success) {
                        setCreatedRoom(prev => prev ? { ...prev, roomCode: data.roomCode } : prev);
                    }
                } catch (e) { /* ignore */ }
                seconds = 15;
                setCodeTimer(15);
            }
        }, 1000);
    }

    async function handleJoinRoom() {
        if (!joinCode.trim()) return;
        setJoining(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode: joinCode.trim().toUpperCase() })
            });
            const data = await res.json();
            if (data.success) {
                setShowJoinModal(false);
                setJoinCode('');
                navigate(`/room/${data.roomCode}`, { state: { internalId: data.internalId } });
            } else if (data.needsPassword) {
                setJoinRoomData({ roomCode: joinCode.trim().toUpperCase(), internalId: data.internalId });
                setShowJoinModal(false);
                setShowPasswordPrompt(true);
            } else {
                addToast(data.error || 'Room not found', 'error');
            }
        } catch (err) {
            addToast('Failed to join room', 'error');
        }
        setJoining(false);
    }

    async function handlePasswordSubmit() {
        setJoining(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode: joinRoomData.roomCode, password: joinPassword })
            });
            const data = await res.json();
            if (data.success) {
                setShowPasswordPrompt(false);
                setJoinPassword('');
                navigate(`/room/${data.roomCode}`, { state: { internalId: data.internalId } });
            } else {
                addToast('Access Denied.', 'error');
            }
        } catch (err) {
            addToast('Failed to verify password', 'error');
        }
        setJoining(false);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            addToast('Copied to clipboard', 'success');
        });
    }

    const inviteUrl = createdRoom ? `${window.location.origin}/join/${createdRoom.inviteToken}` : '';

    return (
        <div className="home-container">
            <div className="home-bg-effect effect-1" />
            <div className="home-bg-effect effect-2" />

            <div className="home-content">
                <h1 className="home-title">TruthVault</h1>
                <p className="home-subtitle">
                    <em>Anonymous. Secure. Temporary.</em><br />
                    Your words disappear, but the truth remains vaulted.
                </p>

                <div className="home-actions">
                    <button id="btn-create-room" className="btn btn-primary btn-lg" onClick={() => setShowCreateModal(true)}>
                        🔐 Create Room
                    </button>
                    <button id="btn-join-room" className="btn btn-secondary btn-lg" onClick={() => setShowJoinModal(true)}>
                        🚪 Join Room
                    </button>
                </div>

                <div className="home-features">
                    <div className="feature-pill"><span className="pill-icon">🕵️</span> Zero Identity</div>
                    <div className="feature-pill"><span className="pill-icon">💨</span> Ephemeral Messages</div>
                    <div className="feature-pill"><span className="pill-icon">🔒</span> Encrypted Rooms</div>
                    <div className="feature-pill"><span className="pill-icon">🛡️</span> Screenshot Guard</div>
                </div>
            </div>

            {/* Create Room Modal */}
            <Modal isOpen={showCreateModal} onClose={cleanupCreateModal}>
                {!createdRoom ? (
                    <>
                        <div className="modal-header">
                            <h2>Create a Secure Room</h2>
                            <p>Configure your anonymous room settings</p>
                        </div>
                        <div className="modal-body">
                            <div className="toggle-wrapper">
                                <button
                                    className={`toggle ${usePassword ? 'active' : ''}`}
                                    onClick={() => setUsePassword(!usePassword)}
                                />
                                <span className="toggle-label">Set Room Password</span>
                            </div>
                            {usePassword && (
                                <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                                    <label>Room Password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={roomPassword}
                                        onChange={e => setRoomPassword(e.target.value)}
                                        placeholder="Enter a secure password..."
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={cleanupCreateModal}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateRoom}
                                disabled={creating || (usePassword && !roomPassword.trim())}
                            >
                                {creating ? 'Creating...' : 'Create Room'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="modal-header">
                            <h2>Room Created! 🎉</h2>
                            <p>Share the code or invite link to let others join</p>
                        </div>
                        <div className="modal-body">
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block' }}>
                                    Room Code <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>refreshes in {codeTimer}s</span>
                                </label>
                                <div className="room-code-display">{createdRoom.roomCode}</div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block' }}>
                                    One-Time Invite Link
                                </label>
                                <div className="invite-link-display">
                                    <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="link-text">{inviteUrl}</a>
                                    <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(inviteUrl)}>📋</button>
                                </div>
                            </div>

                            <button className="btn btn-secondary btn-sm" onClick={() => setShowQR(!showQR)}>
                                {showQR ? 'Hide QR Code' : '📱 Generate QR Code'}
                            </button>

                            {showQR && (
                                <div className="qr-container" style={{ animation: 'scaleIn 0.3s ease' }}>
                                    <QRCodeSVG value={inviteUrl} size={180} />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={cleanupCreateModal}>Close</button>
                            <button className="btn btn-primary" onClick={() => {
                                const roomData = { ...createdRoom };
                                cleanupCreateModal();
                                navigate(`/room/${roomData.roomCode}`, { state: { internalId: roomData.internalId } });
                            }}>
                                Enter Room →
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            {/* Join Room Modal */}
            <Modal isOpen={showJoinModal} onClose={() => { setShowJoinModal(false); setJoinCode(''); }}>
                <div className="modal-header">
                    <h2>Join a Room</h2>
                    <p>Enter the room code to join an anonymous conversation</p>
                </div>
                <div className="modal-body">
                    <div className="input-group">
                        <label>Room Code</label>
                        <input
                            type="text"
                            className="input input-code"
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="XXXX-XXXX"
                            maxLength={9}
                            onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => { setShowJoinModal(false); setJoinCode(''); }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleJoinRoom} disabled={joining || !joinCode.trim()}>
                        {joining ? 'Joining...' : 'Join Room'}
                    </button>
                </div>
            </Modal>

            {/* Password Prompt Modal */}
            <Modal isOpen={showPasswordPrompt} onClose={() => { setShowPasswordPrompt(false); setJoinPassword(''); }}>
                <div className="modal-header">
                    <h2>🔒 Room Protected</h2>
                    <p>This room requires a password to enter</p>
                </div>
                <div className="modal-body">
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="input"
                            value={joinPassword}
                            onChange={e => setJoinPassword(e.target.value)}
                            placeholder="Enter room password..."
                            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => { setShowPasswordPrompt(false); setJoinPassword(''); }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handlePasswordSubmit} disabled={joining || !joinPassword.trim()}>
                        {joining ? 'Verifying...' : 'Enter'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}
