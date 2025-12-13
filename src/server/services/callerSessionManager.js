import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = path.join(__dirname, '../data/callerSessions.json');

class CallerSessionManager {
    constructor() {
        this.sessions = new Map(); // token -> session data
        this.loadSessions();
    }

    loadSessions() {
        try {
            if (fs.existsSync(SESSIONS_FILE)) {
                const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
                const sessions = JSON.parse(data);

                // Convert array back to Map and filter out expired sessions
                const now = Date.now();
                sessions.forEach(session => {
                    if (session.expiresAt > now) {
                        this.sessions.set(session.token, session);
                    }
                });

                console.log(`Loaded ${this.sessions.size} active caller sessions`);
                this.saveSessions(); // Save to remove expired sessions
            }
        } catch (error) {
            console.error('Error loading caller sessions:', error);
            this.sessions = new Map();
        }
    }

    saveSessions() {
        try {
            // Convert Map to array for JSON serialization
            const sessionsArray = Array.from(this.sessions.values());
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsArray, null, 2));
        } catch (error) {
            console.error('Error saving caller sessions:', error);
        }
    }

    createSession(callerId, username) {
        const token = crypto.randomBytes(32).toString('hex');
        const session = {
            token,
            callerId,
            username,
            createdAt: Date.now(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
            lastActivity: Date.now()
        };

        this.sessions.set(token, session);
        this.saveSessions();
        return token;
    }

    validateSession(token) {
        const session = this.sessions.get(token);
        if (!session) {
            return null;
        }

        // Check if session is expired
        if (session.expiresAt < Date.now()) {
            this.sessions.delete(token);
            this.saveSessions();
            return null;
        }

        // Update last activity
        session.lastActivity = Date.now();
        this.saveSessions();

        return {
            callerId: session.callerId,
            username: session.username
        };
    }

    revokeSession(token) {
        const deleted = this.sessions.delete(token);
        if (deleted) {
            this.saveSessions();
        }
        return deleted;
    }

    revokeAllSessionsForCaller(callerId) {
        const tokensToDelete = [];
        this.sessions.forEach((session, token) => {
            if (session.callerId === callerId) {
                tokensToDelete.push(token);
            }
        });

        tokensToDelete.forEach(token => {
            this.sessions.delete(token);
        });

        if (tokensToDelete.length > 0) {
            this.saveSessions();
        }

        return tokensToDelete.length;
    }

    getActiveSessionsForCaller(callerId) {
        const sessions = [];
        this.sessions.forEach(session => {
            if (session.callerId === callerId) {
                sessions.push(session);
            }
        });
        return sessions;
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        let cleaned = 0;

        this.sessions.forEach((session, token) => {
            if (session.expiresAt < now) {
                this.sessions.delete(token);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            this.saveSessions();
            console.log(`Cleaned up ${cleaned} expired caller sessions`);
        }

        return cleaned;
    }
}

// Export singleton instance
export const callerSessionManager = new CallerSessionManager();

// Clean up expired sessions every hour
setInterval(() => {
    callerSessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);