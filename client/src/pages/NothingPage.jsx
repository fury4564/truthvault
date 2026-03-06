import { useState } from 'react';
import { API_URL } from '../socket';
import AdminPanel from './AdminPanel';

export default function NothingPage() {
    const [password, setPassword] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [sessionId] = useState(() => Math.random().toString(36).substring(2));
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!password.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password.trim(), sessionId })
            });
            const data = await res.json();

            if (data.unlocked) {
                setIsUnlocked(true);
                setFeedback('');
            } else {
                setFeedback(data.message || '❌ Incorrect Password');
                setPassword('');
            }
        } catch (err) {
            setFeedback('Connection error');
        }
        setLoading(false);
    }

    if (isUnlocked) {
        return <AdminPanel />;
    }

    return (
        <div className="nothing-container">
            <div className="nothing-input-group">
                <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder=""
                    autoFocus
                />
                <button className="btn btn-secondary" onClick={handleSubmit} disabled={loading}>
                    {loading ? '...' : 'Enter'}
                </button>
            </div>
            {feedback && <div className="nothing-feedback" style={{ color: 'var(--accent-danger)' }}>{feedback}</div>}
        </div>
    );
}
