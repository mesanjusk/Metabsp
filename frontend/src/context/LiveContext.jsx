import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { socket } from '../socket';
// Use BulkAuthContext so we get user.roleId.code (event management auth)
import { useAuth } from './BulkAuthContext';

const LiveContext = createContext();
const EVENT_NAMES = ['whatsapp_message_logged','whatsapp_incoming_message','baileys_message_logged','baileys_incoming_message','notification_created','campaign_updated'];

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    EVENT_NAMES.forEach((name) => socket.on(name, (payload) => setEvents((prev) => [{ name, payload, at: Date.now() }, ...prev].slice(0, 50))));
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      EVENT_NAMES.forEach((name) => socket.off(name));
    };
  }, []);

  useEffect(() => {
    if (user?.roleId?.code) socket.emit('join-role-room', user.roleId.code);
  }, [user]);

  return <LiveContext.Provider value={useMemo(() => ({ events, connected }), [events, connected])}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
