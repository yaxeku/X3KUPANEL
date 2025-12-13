
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();


// In a real application, you'd want to store this securely,
// preferably in environment variables
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: process.env.ADMIN_ACCESS_KEY,
    token: process.env.ADMIN_ACCESS_KEY
};

const CALLER_CREDENTIALS = {
    username: 'caller',
    password: process.env.CALLER_ACCESS_KEY || 'caller123', // Set CALLER_ACCESS_KEY in your .env file
    token: process.env.CALLER_ACCESS_KEY || 'caller123'
};

// Verify admin token
export function verifyAdmin(token) {
    return token === ADMIN_CREDENTIALS.token;
}

// Verify caller token
export function verifyCaller(token) {
    return token === CALLER_CREDENTIALS.token || token === `caller_${CALLER_CREDENTIALS.token}`;
}

// Verify any valid token (admin or caller)
export function verifyToken(token) {
    return verifyAdmin(token) || verifyCaller(token);
}

// Generate session token
export function generateToken(username, password) {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        return ADMIN_CREDENTIALS.token;
    }
    return null;
}

// Hash function for passwords (use in production)
export function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}