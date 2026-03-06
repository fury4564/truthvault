import { io } from 'socket.io-client';

const isDev = import.meta.env.DEV;
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
    (isDev ? `${window.location.protocol}//${window.location.hostname}:3001` : window.location.origin);

let socket = null;

export function getSocket() {
    if (!socket) {
        socket = io(SERVER_URL, {
            autoConnect: false,
            transports: ['websocket', 'polling']
        });
    }
    return socket;
}

export function connectSocket() {
    const s = getSocket();
    if (!s.connected) s.connect();
    return s;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export const API_URL = SERVER_URL;
