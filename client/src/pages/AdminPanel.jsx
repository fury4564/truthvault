import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../socket';
import { useToast } from '../components/Toast';

export default function AdminPanel() {
    const navigate = useNavigate();
    const addToast = useToast();

    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, []);

    async function fetchRooms() {
        try {
            const res = await fetch(`${API_URL}/api/admin/rooms`);
            const data = await res.json();
            setRooms(data.rooms || []);
        } catch (err) {
            addToast('Failed to load rooms', 'error');
        }
        setLoading(false);
    }

    async function handleSelectRoom(room) {
        setSelectedRoom(room);
        try {
            const res = await fetch(`${API_URL}/api/admin/rooms/${room.internal_id}/logs`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (err) {
            addToast('Failed to load logs', 'error');
        }
    }

    async function handleSearch() {
        if (!searchQuery.trim()) {
            fetchRooms();
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/admin/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setRooms(data.rooms || []);
        } catch (err) {
            addToast('Search failed', 'error');
        }
    }

    async function handleDeleteRoom(internalId) {
        if (!confirm('Archive/Delete this room? This will disconnect all users.')) return;
        try {
            await fetch(`${API_URL}/api/admin/rooms/${internalId}`, { method: 'DELETE' });
            addToast('Room deleted', 'success');
            setSelectedRoom(null);
            setLogs([]);
            fetchRooms();
        } catch (err) {
            addToast('Failed to delete room', 'error');
        }
    }

    function handleDownload(internalId, format) {
        window.open(`${API_URL}/api/admin/rooms/${internalId}/download?format=${format}`, '_blank');
    }

    function handleGhostJoin(room) {
        navigate(`/room/${room.room_code}`, {
            state: { internalId: room.internal_id, isGhost: true }
        });
    }

    function formatDate(ts) {
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return ts;
        }
    }

    const filteredRooms = rooms;

    return (
        <div className="admin-container">
            <div className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <h2>🔓 Admin Panel</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="input admin-search"
                            placeholder="Search rooms or users..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="btn btn-sm btn-secondary" onClick={handleSearch}>🔍</button>
                    </div>
                </div>
                <div className="admin-room-list">
                    {loading && <div className="admin-empty-state"><span>Loading...</span></div>}
                    {!loading && filteredRooms.length === 0 && (
                        <div className="admin-empty-state" style={{ padding: 40 }}>
                            <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>📭</span>
                            <span style={{ fontSize: '0.8rem' }}>No rooms found</span>
                        </div>
                    )}
                    {filteredRooms.map(room => (
                        <div
                            key={room.internal_id}
                            className={`admin-room-item ${selectedRoom?.internal_id === room.internal_id ? 'selected' : ''}`}
                            onClick={() => handleSelectRoom(room)}
                        >
                            <div className="room-item-code">{room.room_code}</div>
                            <div className="room-item-meta">
                                <span className="status">
                                    <span className={room.is_active ? 'dot-active' : 'dot-inactive'} />
                                    {room.is_active ? 'Active' : 'Archived'}
                                </span>
                                <span>{room.message_count || 0} msgs</span>
                                <span>{room.activeUsers || 0} users</span>
                            </div>
                            <div className="room-item-meta" style={{ marginTop: 2 }}>
                                <span>{formatDate(room.created_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="admin-main">
                {selectedRoom ? (
                    <>
                        <div className="admin-main-header">
                            <h3>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)' }}>
                                    {selectedRoom.room_code}
                                </span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    background: selectedRoom.is_active ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255,255,255,0.05)',
                                    color: selectedRoom.is_active ? 'var(--accent-success)' : 'var(--text-muted)'
                                }}>
                                    {selectedRoom.is_active ? 'ACTIVE' : 'ARCHIVED'}
                                </span>
                            </h3>
                            <div className="admin-actions">
                                {selectedRoom.is_active && (
                                    <button className="btn btn-sm btn-secondary" onClick={() => handleGhostJoin(selectedRoom)} title="Ghost Mode Join">
                                        👻 Ghost
                                    </button>
                                )}
                                <button className="btn btn-sm btn-secondary" onClick={() => handleDownload(selectedRoom.internal_id, 'txt')}>
                                    📄 TXT
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => handleDownload(selectedRoom.internal_id, 'json')}>
                                    📋 JSON
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRoom(selectedRoom.internal_id)}>
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                        <div className="admin-log-viewer">
                            {logs.length === 0 ? (
                                <div className="admin-empty-state">
                                    <span className="empty-icon">📝</span>
                                    <span>No messages in this room yet</span>
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className={`admin-log-entry event-${log.event_type}`}>
                                        <span className="log-time">{formatDate(log.timestamp)}</span>
                                        <span className="log-content">
                                            {log.event_type === 'audio_message' ? (
                                                <audio controls src={log.message_content} style={{ maxWidth: '240px', outline: 'none', height: '36px', verticalAlign: 'middle' }} />
                                            ) : (
                                                log.message_content
                                            )}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="admin-empty-state">
                        <span className="empty-icon">🔍</span>
                        <span>Select a room to view its complete chat log</span>
                        <span style={{ fontSize: '0.75rem' }}>All messages are retained here, even after users leave</span>
                    </div>
                )}
            </div>
        </div>
    );
}
