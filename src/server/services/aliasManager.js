import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALIASES_FILE = path.join(__dirname, '../data/aliases.json');

class AliasManager {
    constructor() {
        this.aliases = {};
        this.loadAliases();
    }

    loadAliases() {
        try {
            if (fs.existsSync(ALIASES_FILE)) {
                const data = fs.readFileSync(ALIASES_FILE, 'utf8');
                this.aliases = JSON.parse(data);
                console.log(`Loaded ${Object.keys(this.aliases).length} session aliases`);
            } else {
                this.saveAliases();
            }
        } catch (error) {
            console.error('Error loading aliases:', error);
            this.aliases = {};
        }
    }

    saveAliases() {
        try {
            fs.writeFileSync(ALIASES_FILE, JSON.stringify(this.aliases, null, 2));
        } catch (error) {
            console.error('Error saving aliases:', error);
        }
    }

    getAllAliases() {
        return this.aliases;
    }

    getAlias(sessionId) {
        return this.aliases[sessionId] || sessionId.slice(0, 8);
    }

    setAlias(sessionId, alias) {
        const trimmedAlias = alias.trim();
        this.aliases[sessionId] = trimmedAlias || sessionId.slice(0, 8);
        this.saveAliases();
        return this.aliases[sessionId];
    }

    deleteAlias(sessionId) {
        delete this.aliases[sessionId];
        this.saveAliases();
    }

    clearAliases() {
        this.aliases = {};
        this.saveAliases();
    }
}

// Export singleton instance
export const aliasManager = new AliasManager();