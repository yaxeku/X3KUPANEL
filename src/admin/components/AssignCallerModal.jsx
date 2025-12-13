import React, { useState } from 'react';
import { X, UserCheck, Users } from 'lucide-react';

const AssignCallerModal = ({ isOpen, onClose, session, callers, onAssign }) => {
  const [selectedCaller, setSelectedCaller] = useState('');
  const [alias, setAlias] = useState(session?.alias || '');

  if (!isOpen) return null;

  const handleAssign = () => {
    // Use existing alias if present, otherwise require a new one
    const finalAlias = session?.alias || alias.trim();
    if (selectedCaller && finalAlias) {
      onAssign(session.id, selectedCaller, finalAlias);
      onClose();
      setSelectedCaller('');
      setAlias('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#161A22] rounded-xl border border-gray-800/50 p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Assign Session</h3>
              <p className="text-xs text-gray-400">Select a caller for this session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Session Info */}
        <div className="bg-[#1C2029] rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 mb-1">Session ID</p>
          <p className="text-sm text-white font-mono">{session.id}</p>
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
            <span>{session.ip}</span>
            <span>{session.city}, {session.country}</span>
          </div>
        </div>

        {/* Alias Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Alias {!session?.alias && <span className="text-red-400">*</span>}
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder={session?.alias ? `Current: ${session.alias} (optional)` : "Enter an alias for this session"}
            className="w-full px-3 py-2 bg-[#1C2029] border border-gray-800/50 rounded-lg
                     text-white placeholder-gray-500 focus:border-purple-500/50
                     focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
          />
          <p className="text-xs text-gray-500 mt-1">
            {session?.alias
              ? `Current alias: "${session.alias}". Leave empty to keep it.`
              : "This alias will help identify the session"}
          </p>
        </div>

        {/* Caller Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Available Callers
          </label>

          {callers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {callers.map((caller) => (
                <label
                  key={caller.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border cursor-pointer
                    transition-all duration-200
                    ${selectedCaller === caller.username
                      ? 'bg-purple-500/20 border-purple-500/50 ring-1 ring-purple-500/30'
                      : 'bg-[#1C2029] border-gray-800/50 hover:border-gray-700'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="caller"
                      value={caller.username}
                      checked={selectedCaller === caller.username}
                      onChange={(e) => setSelectedCaller(e.target.value)}
                      className="w-4 h-4 text-purple-500 bg-[#1C2029] border-gray-600 focus:ring-purple-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{caller.username}</p>
                      {caller.name && (
                        <p className="text-xs text-gray-400">{caller.name}</p>
                      )}
                    </div>
                  </div>
                  {caller.activeSessions !== undefined && (
                    <span className="text-xs text-gray-500">
                      {caller.activeSessions} active
                    </span>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No callers available</p>
              <p className="text-xs mt-1">Create callers in the Callers section</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white
                     bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedCaller || (!session?.alias && !alias.trim()) || callers.length === 0}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              flex items-center space-x-2
              ${selectedCaller && (session?.alias || alias.trim()) && callers.length > 0
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <UserCheck className="w-4 h-4" />
            <span>Assign Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignCallerModal;