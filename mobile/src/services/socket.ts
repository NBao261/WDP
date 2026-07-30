import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { TOKEN_KEY } from './api';

// ─── Socket URL (same server, no /api/v1 path) ───────
function getSocketUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/v1\/?$/, '');
  }

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:5000`;
    }
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

// ─── Singleton Socket Instance ────────────────────────
let socket: Socket | null = null;
let isConnecting = false;

export const connectSocket = async (): Promise<Socket | null> => {
  if (socket?.connected) return socket;
  if (isConnecting) return socket;

  isConnecting = true;

  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      console.log('[Socket] No token, skip connect');
      isConnecting = false;
      return null;
    }

    const url = getSocketUrl();
    console.log('[Socket] Connecting to', url);

    socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.log('[Socket] Connect error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    isConnecting = false;
    return socket;
  } catch (err) {
    console.log('[Socket] Error:', err);
    isConnecting = false;
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] Manually disconnected');
  }
};

export const getSocket = (): Socket | null => socket;

// ─── Convenience: listen to events ────────────────────
export const onSocketEvent = (event: string, callback: (...args: any[]) => void) => {
  if (socket) {
    socket.on(event, callback);
  }
  return () => {
    if (socket) {
      socket.off(event, callback);
    }
  };
};
