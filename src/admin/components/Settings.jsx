import React, { useState, useEffect } from 'react';
import { useAdminSocket } from '../contexts/AdminSocket';
import { Globe, Shield, Bot, Link, FileCode, Palette, Moon, Snowflake, Leaf, Ghost } from 'lucide-react';
import BannedIPs from './BannedIPs';
import { useTheme } from '../contexts/ThemeContext';

const SettingToggle = ({ icon: Icon, title, description, enabled, onToggle, color }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    if (hasChanged) {
      const timer = setTimeout(() => setHasChanged(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasChanged]);

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 750);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  const getIconColor = () => {
    if (!enabled) return 'text-white/50';
    switch (color) {
      case 'green': return 'text-green-400';
      case 'blue': return 'text-blue-400';
      case 'purple': return 'text-purple-400';
      case 'red': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getIconAnimation = () => {
    return enabled ? 'animate-pulse-subtle' : '';
  };

  const handleToggle = () => {
    setHasChanged(true);
    setIsAnimating(true);
    onToggle();
  };

  return (
    <div
      className="group relative px-4 py-3.5 transition-all duration-500 hover:bg-gray-800/30"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      {/* Status change animation */}
      {hasChanged && (
        <div className={`
          absolute inset-0 bg-${color}-500/20
          animate-[fadeOut_1s_ease-out]
        `} />
      )}

      {/* Active state glow with enhanced animations */}
      {enabled && (
        <>
          <div className={`
            absolute inset-0 blur-2xl transition-all duration-1000
            bg-gradient-to-r ${
              color === 'green' ? 'from-green-500/10' :
              color === 'blue' ? 'from-blue-500/10' :
              color === 'purple' ? 'from-purple-500/10' :
              'from-red-500/10'} to-transparent
            animate-pulse-subtle
            ${isAnimating ? 'scale-110 opacity-75' : 'scale-100 opacity-50'}
          `} />
          <div className={`
            absolute inset-0 blur-md
            bg-gradient-to-r ${
              color === 'green' ? 'from-green-500/20' :
              color === 'blue' ? 'from-blue-500/20' :
              color === 'purple' ? 'from-purple-500/20' :
              'from-red-500/20'} to-transparent
            transition-opacity duration-500
            ${isAnimating ? 'opacity-100' : 'opacity-0'}
          `} />
        </>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <div className={`
            p-2 rounded-xl
            ${enabled ? 'bg-[#1C2029]' : 'bg-[#1C2029]/60'}
            transform transition-all duration-500
            ${isPressed ? 'scale-95' : 'scale-100'}
            ${isHovered ? 'rotate-6 scale-110' : 'rotate-0'}
            ${isAnimating ? 'rotate-[360deg]' : ''}
          `}>
            <Icon className={`w-5 h-5 ${getIconColor()} ${getIconAnimation()}
                           transition-all duration-500
                           ${isHovered ? 'scale-110' : 'scale-100'}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-300 transition-colors duration-300 group-hover:text-white">
              {title}
            </h3>
            <p className="text-xs text-gray-500 transition-colors duration-300 group-hover:text-gray-400">
              {description}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          className={`
            relative w-14 h-7 rounded-full transition-all duration-500
            ${enabled
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
              : 'bg-white/10'}
            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/20
            ${isPressed ? 'scale-95' : ''}
            group
          `}
        >
          {/* Animated background pulse */}
          {enabled && (
            <div className={`
              absolute inset-0 rounded-full blur-md
              bg-gradient-to-r from-blue-500 to-blue-600
              animate-pulse opacity-50
            `} />
          )}
          
          <div className={`
            absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full 
            shadow-lg transition-all duration-500 transform
            ${enabled ? 'translate-x-7' : 'translate-x-0'}
            ${isPressed ? 'scale-90' : 'scale-100'}
          `}>
            {/* Inner circle animation */}
            <div className={`
              absolute inset-1 rounded-full transition-all duration-500
              ${enabled
                ? 'bg-gradient-to-br from-blue-400 to-blue-500'
                : 'bg-gray-400'}
              ${isAnimating ? 'animate-spin' : ''}
            `} />
          </div>
        </button>
      </div>
    </div>
  );
};

const InputField = ({ icon: Icon, label, value, onChange, type = 'text' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="px-4 py-3.5 transition-all duration-300 hover:bg-gray-800/30"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center space-x-3">
        <div className={`
          p-2 rounded-xl bg-[#1C2029]/60
          transform transition-all duration-300
          ${isFocused ? 'scale-110 rotate-6' : 'scale-100 rotate-0'}
        `}>
          <Icon className={`w-5 h-5 transition-colors duration-300
            ${isFocused ? 'text-blue-400' : 'text-gray-500'}
            ${isHovered && !isFocused && 'text-gray-400'}
          `} />
        </div>
        <div className="flex-1 transition-transform duration-300 group-hover:translate-x-1">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
          <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              w-full px-3 py-1.5 rounded-lg
              bg-[#1C2029] border border-gray-800/50
              text-gray-300 placeholder-gray-600
              transition-all duration-300
              ${isFocused ?
                'border-blue-500/50 ring-2 ring-blue-500/20 bg-[#1E222B]' :
                'hover:border-gray-700'}
            `}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, children }) => (
  <div className="relative rounded-xl overflow-hidden theme-primary-bg border theme-border">
    <div className="relative">
      <div className="px-4 py-3 border-b theme-border">
        <h2 className="text-lg font-medium theme-text-secondary">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-gray-800/50">
        {children}
      </div>
    </div>
  </div>
);

const ThemeSelector = () => {
  const { currentTheme, changeTheme, themes } = useTheme();

  const themeIcons = {
    lunar: Moon,
    halloween: Ghost,
    fall: Leaf,
    christmas: Snowflake
  };

  const themeColors = {
    lunar: 'blue',
    halloween: 'orange',
    fall: 'amber',
    christmas: 'red'
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start space-x-3">
        <Palette className="w-5 h-5 mt-1 theme-accent" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium theme-text-primary">
                Theme
              </h3>
              <p className="text-xs theme-text-muted mt-1">
                Choose your visual theme
              </p>
            </div>
            <select
              value={currentTheme}
              onChange={(e) => changeTheme(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border
                       theme-secondary-bg theme-border theme-text-primary
                       focus:outline-none focus:ring-2 focus:ring-opacity-50
                       transition-all duration-200"
              style={{ minWidth: '140px' }}
            >
              {themes.map(theme => {
                const Icon = themeIcons[theme.id];
                return (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            {themes.map(theme => {
              const Icon = themeIcons[theme.id];
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => changeTheme(theme.id)}
                  className={`
                    p-2 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'theme-accent-bg ring-2 ring-offset-2 ring-offset-transparent'
                      : 'theme-hover-bg hover:scale-110'
                    }
                  `}
                  style={{
                    '--tw-ring-color': isActive ? 'var(--accent)' : 'transparent'
                  }}
                  title={theme.name}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'theme-accent' : 'theme-text-muted'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Settings() {
  const { settings, updateSettings } = useAdminSocket();

  const handleToggle = (key) => {
    updateSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 px-4 lg:px-0">
      {/* Main Settings Column */}
      <div className="lg:col-span-8 space-y-6">
        {/* Appearance Card */}
        <Card title="Appearance">
          <ThemeSelector />
        </Card>

        {/* Security Settings Card */}
        <Card title="Security Settings">
          <SettingToggle
            icon={Globe}
            title="Website Status"
            description="Enable or disable the website"
            enabled={settings.websiteEnabled}
            onToggle={() => handleToggle('websiteEnabled')}
            color="green"
          />
          <SettingToggle
            icon={Shield}
            title="VPN/Proxy Blocking"
            description="Block access from VPN/Proxy connections"
            enabled={settings.vpnBlockEnabled}
            onToggle={() => handleToggle('vpnBlockEnabled')}
            color="blue"
          />
          <SettingToggle
            icon={Bot}
            title="Anti-Bot Protection"
            description="Enable bot detection and blocking"
            enabled={settings.antiBotEnabled}
            onToggle={() => handleToggle('antiBotEnabled')}
            color="purple"
          />
        </Card>

        {/* Configuration Card */}
        <Card title="Configuration">
          <InputField
            icon={Link}
            label="Redirect URL"
            value={settings.redirectUrl}
            onChange={(e) => updateSettings({ ...settings, redirectUrl: e.target.value })}
            type="url"
          />
          <InputField
            icon={FileCode}
            label="Default Landing Page"
            value={settings.defaultLandingPage}
            onChange={(e) => updateSettings({ ...settings, defaultLandingPage: e.target.value })}
          />
        </Card>
      </div>

      {/* Banned IPs Column */}
      <div className="lg:col-span-4">
        <BannedIPs />
      </div>
    </div>
  );
}