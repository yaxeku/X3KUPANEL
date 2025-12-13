import React, { useState } from 'react';
import { useAdminSocket } from '../contexts/AdminSocket';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Shield, Globe, Clipboard, Trash2, Download, Waves, Anchor, LogOut
} from 'lucide-react';

const StatCard = ({ icon: Icon, title, value, secondary, type = 'default' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getIconColor = () => {
    switch (type) {
      case 'active':
        return 'text-blue-400';
      case 'banned':
        return 'text-red-400';
      case 'status-online':
        return 'text-emerald-400';
      case 'status-offline':
        return 'text-gray-400';
      default:
        return 'text-blue-300';
    }
  };

  const displayValue = typeof value === 'number' ? value : value;

  return (
    <div
      className="group relative rounded-xl overflow-hidden theme-primary-bg border theme-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content */}
      <div className="relative p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="transition-transform duration-300 group-hover:translate-x-1">
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-2xl lg:text-3xl font-semibold text-white">{displayValue}</span>
              {secondary !== undefined && (
                <span className="text-gray-500 text-base lg:text-lg">/{secondary}</span>
              )}
            </div>
          </div>
          <div className={`p-2 lg:p-3 rounded-xl bg-[#1C2029] border border-gray-800/50
                        transform transition-all duration-300
                        ${isHovered ? 'scale-110' : 'scale-100'}`}>
            <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${getIconColor()}
                          transition-transform duration-300
                          ${type === 'status-online' ? 'animate-pulse' : ''}
                          ${isHovered ? 'scale-110' : 'scale-100'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickAction = ({ icon: Icon, label, onClick, variant = 'primary', active = false }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      className={`group relative flex items-center space-x-2
                px-3 py-2 lg:px-4 lg:py-2 rounded-lg
                bg-[#1C2029] hover:bg-[#1E222B]
                border border-gray-800/50
                transition-all duration-300 w-full lg:w-auto
                ${isPressed ? 'scale-95' : 'scale-100'}
                ${active ? 'bg-blue-500/10 border-blue-500/30' : ''}
                overflow-hidden`}
    >
      {/* Icon and label */}
      <Icon className={`w-4 h-4 transition-transform duration-300
                     ${variant === 'danger' ? 'text-red-400' : active ? 'text-blue-400' : 'text-gray-400'}
                     ${isHovered ? 'scale-110' : 'scale-100'}`} />
      <span className={`text-sm transition-transform duration-300
                     ${variant === 'danger' ? 'text-red-400' : active ? 'text-blue-400' : 'text-gray-300'}
                     group-hover:translate-x-0.5 whitespace-nowrap`}>
        {label}
      </span>
    </button>
  );
};

export default function Dashboard() {
  const { sessions, settings, bannedIPs, clearSessions, updateSettings } = useAdminSocket();
  const { logout, userRole } = useAuth();

  const activeSessions = sessions.filter(s => s.connected).length;
  const totalSessions = sessions.length;

  return (
    <div className="space-y-4 lg:space-y-6 relative">
      {/* Logout Button - Top Right */}
      <button
        onClick={() => {
          if (window.confirm('Are you sure you want to logout?')) {
            logout();
          }
        }}
        className="absolute top-0 right-0 z-10 flex items-center space-x-2
                   px-4 py-2 rounded-lg
                   bg-red-500/10 hover:bg-red-500/20
                   border border-red-500/30
                   transition-all duration-200
                   text-red-400 hover:text-red-300"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">Logout</span>
      </button>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pt-12">
        <StatCard
          icon={Users}
          title="Active Sessions"
          value={activeSessions}
          secondary={totalSessions > 0 ? totalSessions : undefined}
          type="active"
        />

        <StatCard
          icon={Shield}
          title="Banned IPs"
          value={bannedIPs.size}
          type="banned"
        />

        <StatCard
          icon={Globe}
          title="Website Status"
          value={settings.websiteEnabled ? 'Online' : 'Offline'}
          type={settings.websiteEnabled ? 'status-online' : 'status-offline'}
        />
      </div>

      {/* Quick Actions */}
      <div className="relative rounded-xl overflow-hidden bg-[#161A22] border border-gray-800/50">
        <div className="relative p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Waves className="w-5 h-5 text-blue-400" />
            <h3 className="text-gray-300 text-lg font-medium">Quick Actions</h3>
          </div>
          <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-3">
            <QuickAction
              icon={Clipboard}
              label={`${settings.showAliases ? 'Hide' : 'Show'} Aliases`}
              onClick={() => {
                updateSettings({
                  ...settings,
                  showAliases: !settings.showAliases
                });
              }}
              active={settings.showAliases}
            />
            <QuickAction
              icon={Trash2}
              label={userRole === 'caller' ? "Clear Assignments" : "Clear Sessions"}
              onClick={() => {
                const confirmMessage = userRole === 'caller'
                  ? 'Are you sure you want to clear all your assignments? This action cannot be undone.'
                  : 'Are you sure you want to clear all sessions? This action cannot be undone.';
                if (window.confirm(confirmMessage)) {
                  clearSessions();
                }
              }}
              variant="danger"
            />
            <QuickAction
              icon={Download}
              label="Export Logs"
              onClick={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}