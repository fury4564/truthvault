import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../socket';
import { useToast } from '../components/Toast';

export default function InviteRedirect() {
    const { token } = useParams();
    const navigate = useNavigate();
    const addToast = useToast();
    const [status, setStatus] = useState('Validating invite link...');
    const [needsPassword, setNeedsPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [roomData, setRoomData] = useState(null);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        validateToken();
    }, [token]);

    async function validateToken() {
        try {
            const res = await fetch(`${API_URL}/api/rooms/join/${token}`);
            const data = await res.json();

            if (data.success) {
                if (data.needsPassword) {
                    setNeedsPassword(true);
                    setRoomData(data);
                    setStatus('This room requires a password');
                } else {
                    navigate(`/room/${data.roomCode}`, { state: { internalId: data.internalId } });
                }
            } else {
                setStatus(data.error || 'Invalid or Expired Link');
                addToast('Invalid or Expired Link', 'error');
            }
        } catch (err) {
            setStatus('Connection error. Please try again.');
            addToast('Failed to validate invite link', 'error');
        }
    }

    async function handlePasswordSubmit() {
        if (!password.trim() || !roomData) return;
        setVerifying(true);
        try {
            const res = await fetch(`${API_URL}/api/rooms/${roomData.internalId}/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();

            if (data.success) {
                navigate(`/room/${roomData.roomCode}`, { state: { internalId: roomData.internalId } });
            } else {
                addToast('Access Denied.', 'error');
            }
        } catch (err) {
            addToast('Verification failed', 'error');
        }
        setVerifying(false);
    }

    return (
        <div className="nothing-container">
            {needsPassword ? (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                    <h2 style={{ marginBottom: 8, fontSize: '1.2rem' }}>🔒 Protected Room</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>{status}</p>
                    <div className="nothing-input-group">
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                            placeholder="Enter password..."
                            autoFocus
                        />
                        <button className="btn btn-primary" onClick={handlePasswordSubmit} disabled={verifying || !password.trim()}>
                            {verifying ? '...' : 'Enter'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{status}</p>
                </div>
            )}
        </div>
    );
}
