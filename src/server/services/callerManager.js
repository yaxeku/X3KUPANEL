import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALLERS_FILE = path.join(__dirname, '../data/callers.json');

class CallerManager {
    constructor() {
        this.callers = [];
        this.loadCallers();
    }

    loadCallers() {
        try {
            if (fs.existsSync(CALLERS_FILE)) {
                const data = fs.readFileSync(CALLERS_FILE, 'utf8');
                this.callers = JSON.parse(data);
                console.log(`Loaded ${this.callers.length} caller accounts`);
            } else {
                this.saveCallers();
            }
        } catch (error) {
            console.error('Error loading callers:', error);
            this.callers = [];
        }
    }

    saveCallers() {
        try {
            fs.writeFileSync(CALLERS_FILE, JSON.stringify(this.callers, null, 2));
        } catch (error) {
            console.error('Error saving callers:', error);
        }
    }

    getAllCallers() {
        return this.callers;
    }

    addCaller(callerData) {
        const newCaller = {
            id: crypto.randomBytes(16).toString('hex'),
            username: callerData.username.trim(),
            password: callerData.password.trim(),
            createdAt: Date.now(),
            lastLogin: null
        };

        // Check if username already exists
        if (this.callers.some(c => c.username === newCaller.username)) {
            throw new Error('Username already exists');
        }

        this.callers.push(newCaller);
        this.saveCallers();
        return newCaller;
    }

    updateCaller(id, updatedData) {
        const index = this.callers.findIndex(c => c.id === id);
        if (index === -1) {
            throw new Error('Caller not found');
        }

        // Check if username is being changed and already exists
        if (updatedData.username && updatedData.username !== this.callers[index].username) {
            if (this.callers.some(c => c.username === updatedData.username.trim())) {
                throw new Error('Username already exists');
            }
        }

        this.callers[index] = {
            ...this.callers[index],
            ...updatedData,
            username: updatedData.username ? updatedData.username.trim() : this.callers[index].username,
            password: updatedData.password ? updatedData.password.trim() : this.callers[index].password
        };

        this.saveCallers();
        return this.callers[index];
    }

    deleteCaller(id) {
        const index = this.callers.findIndex(c => c.id === id);
        if (index === -1) {
            throw new Error('Caller not found');
        }

        const deleted = this.callers.splice(index, 1);
        this.saveCallers();
        return deleted[0];
    }

    verifyCaller(username, password) {
        const caller = this.callers.find(c =>
            c.username.trim() === username.trim() &&
            c.password === password
        );

        if (caller) {
            // Update last login
            caller.lastLogin = Date.now();
            this.saveCallers();
            return {
                success: true,
                caller: {
                    id: caller.id,
                    username: caller.username,
                    role: 'caller'
                }
            };
        }

        return {
            success: false,
            error: 'Invalid credentials'
        };
    }

    getCallerByUsername(username) {
        return this.callers.find(c => c.username === username);
    }
}

// Export singleton instance
export const callerManager = new CallerManager();