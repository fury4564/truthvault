const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// =========== UTILITY FUNCTIONS ===========

function generateRoomCode() {
    const chars = '0123456789ABCDEF';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}-${part()}`;
}

function generateToken() {
    return uuidv4().replace(/-/g, '');
}

function generateAnonId() {
    return `User-${Math.floor(100 + Math.random() * 900)}`;
}

const USER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#FF8C69', '#87CEEB', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA', '#F1948A',
    '#AED6F1', '#D7BDE2', '#A3E4D7', '#FAD7A0', '#A9CCE3'
];

function getRandomColor() {
    return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

// =========== ROOM STATE ===========
const activeRooms = new Map();
const adminAuthState = new Map();
const ADMIN_PASSWORD = '6211825';

// =========== REST API ROUTES ===========

app.post('/api/rooms', async (req, res) => {
    try {
        const { password } = req.body;
        const internalId = uuidv4();
        const roomCode = generateRoomCode();
        const inviteToken = generateToken();

        let passwordHash = null;
        if (password && password.trim()) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        db.createRoom(roomCode, internalId, passwordHash);
        db.createInviteLink(internalId, inviteToken);

        activeRooms.set(internalId, { users: new Map(), currentCode: roomCode });

        res.json({ success: true, roomCode, internalId, inviteToken, hasPassword: !!passwordHash });
    } catch (err) {
        console.error('Error creating room:', err);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

app.post('/api/rooms/:internalId/refresh-code', (req, res) => {
    try {
        const { internalId } = req.params;
        const room = db.getActiveRoomByInternalId(internalId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        const newCode = generateRoomCode();
        db.updateRoomCode(internalId, newCode);

        if (activeRooms.has(internalId)) {
            activeRooms.get(internalId).currentCode = newCode;
        }

        res.json({ success: true, roomCode: newCode });
    } catch (err) {
        res.status(500).json({ error: 'Failed to refresh code' });
    }
});

app.post('/api/rooms/join', async (req, res) => {
    try {
        const { roomCode, password } = req.body;
        const room = db.getRoomByCode(roomCode);
        if (!room) return res.status(404).json({ error: 'Room not found or code expired' });

        if (room.password_hash) {
            if (!password) return res.status(401).json({ error: 'Password required', needsPassword: true });
            const valid = await bcrypt.compare(password, room.password_hash);
            if (!valid) return res.status(401).json({ error: 'Access Denied.' });
        }

        res.json({ success: true, internalId: room.internal_id, roomCode: room.room_code });
    } catch (err) {
        res.status(500).json({ error: 'Failed to join room' });
    }
});

app.get('/api/rooms/join/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const link = db.getInviteLinkByToken(token);
        if (!link) return res.status(404).json({ error: 'Invalid or Expired Link' });

        const room = db.getActiveRoomByInternalId(link.room_internal_id);
        if (!room) return res.status(404).json({ error: 'Room no longer exists' });

        db.invalidateInviteLink(token);

        res.json({
            success: true,
            internalId: room.internal_id,
            roomCode: room.room_code,
            needsPassword: !!room.password_hash
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to use invite link' });
    }
});

app.post('/api/rooms/:internalId/verify-password', async (req, res) => {
    try {
        const { internalId } = req.params;
        const { password } = req.body;
        const room = db.getActiveRoomByInternalId(internalId);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (!room.password_hash) return res.json({ success: true });

        const valid = await bcrypt.compare(password, room.password_hash);
        if (!valid) return res.status(401).json({ error: 'Access Denied.' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

app.post('/api/rooms/:internalId/invite', (req, res) => {
    try {
        const { internalId } = req.params;
        const room = db.getActiveRoomByInternalId(internalId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        const newToken = generateToken();
        db.createInviteLink(internalId, newToken);

        res.json({ success: true, inviteToken: newToken });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate invite' });
    }
});

// =========== ADMIN API ===========

app.post('/api/admin/auth', (req, res) => {
    const { password, sessionId } = req.body;
    const key = sessionId || req.ip;

    if (!adminAuthState.has(key)) {
        adminAuthState.set(key, { correctCount: 0 });
    }
    const state = adminAuthState.get(key);

    if (password === ADMIN_PASSWORD) {
        state.correctCount++;
        if (state.correctCount >= 3) {
            adminAuthState.delete(key);
            return res.json({ success: true, unlocked: true });
        }
        return res.json({ success: false, unlocked: false, message: '❌ Incorrect Password' });
    } else {
        state.correctCount = 0;
        return res.json({ success: false, unlocked: false, message: '❌ Incorrect Password' });
    }
});

app.get('/api/admin/rooms', (req, res) => {
    try {
        const rooms = db.getAllRooms();
        const enriched = rooms.map(room => ({
            ...room,
            message_count: db.getMessageCountByRoom(room.internal_id),
            activeUsers: activeRooms.has(room.internal_id) ? activeRooms.get(room.internal_id).users.size : 0
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ rooms: enriched });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list rooms' });
    }
});

app.get('/api/admin/rooms/:internalId/logs', (req, res) => {
    try {
        const logs = db.getLogsByRoom(req.params.internalId);
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/admin/rooms/:internalId/download', (req, res) => {
    try {
        const { internalId } = req.params;
        const { format } = req.query;
        const room = db.getRoomByInternalId(internalId);
        const logs = db.getLogsByRoom(internalId);

        if (format === 'txt') {
            let txt = `=== TruthVault Chat Log ===\nRoom Code: ${room.room_code}\nCreated: ${room.created_at}\n${'='.repeat(30)}\n\n`;
            logs.forEach(log => {
                if (log.event_type === 'message') {
                    txt += `[${log.timestamp}] ${log.anonymous_user_id}: ${log.message_content}\n`;
                } else if (log.event_type === 'audio_message') {
                    txt += `[${log.timestamp}] ${log.anonymous_user_id}: [VOICE MESSAGE - See JSON log for base64 data]\n`;
                } else if (log.event_type === 'image_message') {
                    txt += `[${log.timestamp}] ${log.anonymous_user_id}: [IMAGE/GIF MESSAGE - See JSON log for base64 data]\n`;
                } else {
                    txt += `[${log.timestamp}] ** ${log.message_content} **\n`;
                }
            });
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="truthvault-${room.room_code}.txt"`);
            res.send(txt);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="truthvault-${room.room_code}.json"`);
            res.json({ room, logs });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to download logs' });
    }
});

app.delete('/api/admin/rooms/:internalId', (req, res) => {
    try {
        const { internalId } = req.params;
        db.deactivateRoom(internalId);

        if (activeRooms.has(internalId)) {
            const room = activeRooms.get(internalId);
            room.users.forEach((userData, socketId) => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('room-closed', { message: 'This room has been closed.' });
                    socket.disconnect(true);
                }
            });
            activeRooms.delete(internalId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

app.get('/api/admin/search', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ rooms: [], users: [] });

        const rooms = db.searchRoomsByCode(q).map(room => ({
            ...room,
            message_count: db.getMessageCountByRoom(room.internal_id),
            activeUsers: activeRooms.has(room.internal_id) ? activeRooms.get(room.internal_id).users.size : 0
        }));
        const users = db.searchUserLogs(q);

        res.json({ rooms, users });
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// =========== SOCKET.IO ===========

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', ({ roomInternalId, isGhost }) => {
        const room = db.getActiveRoomByInternalId(roomInternalId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (!activeRooms.has(roomInternalId)) {
            activeRooms.set(roomInternalId, { users: new Map(), currentCode: room.room_code });
        }
        const roomState = activeRooms.get(roomInternalId);

        if (isGhost) {
            socket.join(roomInternalId);
            socket.isGhost = true;
            socket.roomInternalId = roomInternalId;
            socket.emit('joined', {
                anonId: 'Admin-Ghost',
                color: '#888888',
                isGhost: true,
                users: Array.from(roomState.users.values())
            });
            return;
        }

        const anonId = generateAnonId();
        const color = getRandomColor();
        socket.anonId = anonId;
        socket.userColor = color;
        socket.roomInternalId = roomInternalId;

        roomState.users.set(socket.id, { anonId, color });
        socket.join(roomInternalId);

        db.addMessageLog(roomInternalId, anonId, color, `${anonId} joined the room`, 'user_join');

        socket.emit('joined', { anonId, color, users: Array.from(roomState.users.values()) });
        socket.to(roomInternalId).emit('user-joined', { anonId, color });
        io.to(roomInternalId).emit('user-list', Array.from(roomState.users.values()));
    });

    socket.on('send-message', ({ message, messageType = 'text' }) => {
        const roomId = socket.roomInternalId;
        if (!roomId || socket.isGhost) return;

        const timestamp = new Date().toISOString();
        let eventType = 'message';
        if (messageType === 'audio') eventType = 'audio_message';
        if (messageType === 'image') eventType = 'image_message';
        db.addMessageLog(roomId, socket.anonId, socket.userColor, message, eventType);

        const msgData = {
            id: uuidv4(),
            anonId: socket.anonId,
            color: socket.userColor,
            message,
            timestamp,
            messageType
        };

        io.to(roomId).emit('new-message', msgData);
        socket.emit('message-delivered', { messageId: msgData.id });
    });

    socket.on('typing', ({ isTyping }) => {
        const roomId = socket.roomInternalId;
        if (!roomId || socket.isGhost) return;
        socket.to(roomId).emit('user-typing', { anonId: socket.anonId, isTyping });
    });

    socket.on('screenshot-attempt', () => {
        const roomId = socket.roomInternalId;
        if (!roomId) return;
        const warningMsg = '⚠️ Someone is trying to capture this chat.';
        db.addMessageLog(roomId, socket.anonId || 'System', '#FF0000', warningMsg, 'warning');
        io.to(roomId).emit('security-warning', { message: warningMsg });
    });

    socket.on('leave-room', () => handleDisconnect(socket));
    socket.on('disconnect', () => handleDisconnect(socket));
});

function handleDisconnect(socket) {
    const roomId = socket.roomInternalId;
    if (!roomId || socket.isGhost) return;

    const roomState = activeRooms.get(roomId);
    if (roomState) {
        roomState.users.delete(socket.id);
        db.addMessageLog(roomId, socket.anonId || 'Unknown', socket.userColor || '#FFFFFF', `${socket.anonId || 'Unknown'} left the room`, 'user_leave');

        socket.to(roomId).emit('user-left', { anonId: socket.anonId });
        io.to(roomId).emit('user-list', Array.from(roomState.users.values()));

        if (roomState.users.size === 0) {
            setTimeout(() => {
                const state = activeRooms.get(roomId);
                if (state && state.users.size === 0) activeRooms.delete(roomId);
            }, 60000);
        }
    }
    socket.roomInternalId = null;
}

// Catch-all for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔒 TruthVault server running on port ${PORT} (0.0.0.0)`);
});
