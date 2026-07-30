import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';

/**
 * Hook quản lý kết nối socket.io cho mobile app.
 * - Auto connect khi mount, disconnect khi unmount.
 * - Auto reconnect khi app quay lại foreground.
 */
export function useSocketConnection() {
  useEffect(() => {
    connectSocket();

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        const s = getSocket();
        if (!s?.connected) {
          connectSocket();
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      sub.remove();
      // Không disconnect khi unmount layout vì socket dùng chung
    };
  }, []);
}

/**
 * Hook lắng nghe 1 socket event cụ thể.
 * Auto cleanup khi unmount.
 */
export function useSocketEvent(event: string, handler: (...args: any[]) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const listener = (...args: any[]) => handlerRef.current(...args);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
