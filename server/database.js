const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'truthvault_data.json');

// In-memory database with JSON file persistence
let data = {
    rooms: [],
    messageLogs: [],
    inviteLinks: []
};

function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            data = JSON.parse(raw);
        }
    } catch (err) {
        console.error('Error loading data, starting fresh:', err.message);
    }
    return data;
}

function saveData() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving data:', err.message);
    }
}

// Debounced save to avoid too many disk writes
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveData(), 1000);
}

// =========== Room Operations ===========

function createRoom(roomCode, internalId, passwordHash) {
    const room = {
        id: data.rooms.length + 1,
        room_code: roomCode,
        internal_id: internalId,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        is_active: true,
        previous_codes: []
    };
    data.rooms.push(room);
    debouncedSave();
    return room;
}

function getRoomByCode(roomCode) {
    // Match current code OR any previous code
    return data.rooms.find(r => r.is_active && (
        r.room_code === roomCode ||
        (r.previous_codes && r.previous_codes.includes(roomCode))
    ));
}

function getRoomByInternalId(internalId) {
    return data.rooms.find(r => r.internal_id === internalId);
}

function getActiveRoomByInternalId(internalId) {
    return data.rooms.find(r => r.internal_id === internalId && r.is_active);
}

function updateRoomCode(internalId, newCode) {
    const room = data.rooms.find(r => r.internal_id === internalId);
    if (room) {
        // Keep old code in previous_codes so it still works for joining
        if (!room.previous_codes) room.previous_codes = [];
        room.previous_codes.push(room.room_code);
        room.room_code = newCode;
        debouncedSave();
    }
    return room;
}

function deactivateRoom(internalId) {
    const room = data.rooms.find(r => r.internal_id === internalId);
    if (room) {
        room.is_active = false;
        debouncedSave();
    }
    return room;
}

function getAllRooms() {
    return data.rooms;
}

// =========== Message Log Operations ===========

function addMessageLog(roomInternalId, anonUserId, userColor, content, eventType) {
    const log = {
        id: data.messageLogs.length + 1,
        room_internal_id: roomInternalId,
        anonymous_user_id: anonUserId,
        user_color: userColor,
        message_content: content,
        timestamp: new Date().toISOString(),
        event_type: eventType
    };
    data.messageLogs.push(log);
    debouncedSave();
    return log;
}

function getLogsByRoom(roomInternalId) {
    return data.messageLogs
        .filter(l => l.room_internal_id === roomInternalId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function getMessageCountByRoom(roomInternalId) {
    return data.messageLogs.filter(l =>
        l.room_internal_id === roomInternalId &&
        (l.event_type === 'message' || l.event_type === 'audio_message' || l.event_type === 'image_message')
    ).length;
}

// =========== Invite Link Operations ===========

function createInviteLink(roomInternalId, token) {
    const link = {
        id: data.inviteLinks.length + 1,
        room_internal_id: roomInternalId,
        token: token,
        is_used: false,
        created_at: new Date().toISOString()
    };
    data.inviteLinks.push(link);
    debouncedSave();
    return link;
}

function getInviteLinkByToken(token) {
    return data.inviteLinks.find(l => l.token === token && !l.is_used);
}

function invalidateInviteLink(token) {
    const link = data.inviteLinks.find(l => l.token === token);
    if (link) {
        link.is_used = true;
        debouncedSave();
    }
    return link;
}

// =========== Search ===========

function searchRoomsByCode(query) {
    const q = query.toUpperCase();
    return data.rooms.filter(r => r.room_code.toUpperCase().includes(q));
}

function searchUserLogs(query) {
    const q = query.toLowerCase();
    const found = new Map();
    data.messageLogs
        .filter(l => l.anonymous_user_id.toLowerCase().includes(q))
        .forEach(l => {
            if (!found.has(l.anonymous_user_id + '::' + l.room_internal_id)) {
                found.set(l.anonymous_user_id + '::' + l.room_internal_id, {
                    anonymous_user_id: l.anonymous_user_id,
                    room_internal_id: l.room_internal_id
                });
            }
        });
    return Array.from(found.values());
}

// Initialize data on load
loadData();

module.exports = {
    createRoom, getRoomByCode, getRoomByInternalId, getActiveRoomByInternalId,
    updateRoomCode, deactivateRoom, getAllRooms,
    addMessageLog, getLogsByRoom, getMessageCountByRoom,
    createInviteLink, getInviteLinkByToken, invalidateInviteLink,
    searchRoomsByCode, searchUserLogs,
    saveData
};
