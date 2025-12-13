import React, { useState, useEffect } from 'react';
import { useAdminSocket } from '../contexts/AdminSocket';
import { UserPlus, Trash2, Eye, EyeOff, Copy, Check, Phone, Edit2, X, Shield } from 'lucide-react';

const CallerCard = ({ caller, onDelete, onUpdate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaller, setEditedCaller] = useState({
    username: caller.username,
    password: caller.password
  });

  const handleCopy = () => {
    const credentials = `Username: ${caller.username}\nPassword: ${caller.password}`;
    navigator.clipboard.writeText(credentials);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdate(caller.id, editedCaller);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCaller({
      username: caller.username,
      password: caller.password
    });
    setIsEditing(false);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="relative p-4 rounded-xl bg-[#1C2029] border border-gray-800/50 hover:border-gray-700 transition-all duration-300 group">
      {/* Status Badge */}
      <div className="absolute -top-2 right-4">
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-purple-500/10 to-purple-500/20 ring-1 ring-purple-500/30 text-purple-400">
          CALLER
        </div>
      </div>

      {!isEditing ? (
        <>
          {/* View Mode */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
                <Phone className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">{caller.username}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Created: {formatDate(caller.createdAt)}</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          {/* Password Display */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50 font-mono text-sm text-gray-300">
                {showPassword ? caller.password : '••••••••'}
              </div>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                title={showPassword ? 'Hide' : 'Show'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-all duration-300"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy Credentials</span>
                </>
              )}
            </button>
            <button
              onClick={() => onDelete(caller.id)}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all duration-300"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Edit Mode */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Username</label>
              <input
                type="text"
                value={editedCaller.username}
                onChange={(e) => setEditedCaller({ ...editedCaller, username: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50 text-gray-300 focus:outline-none focus:border-purple-500/50"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <input
                type="text"
                value={editedCaller.password}
                onChange={(e) => setEditedCaller({ ...editedCaller, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50 text-gray-300 focus:outline-none focus:border-purple-500/50"
                placeholder="Enter password"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Last Login Info */}
      {caller.lastLogin && (
        <div className="mt-3 pt-3 border-t border-gray-800/50">
          <p className="text-xs text-gray-500">
            Last login: {formatDate(caller.lastLogin)}
          </p>
        </div>
      )}
    </div>
  );
};

const CreateCallerForm = ({ onCreate, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  useEffect(() => {
    if (autoGenerate) {
      setPassword(generatePassword());
    }
  }, [autoGenerate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && password) {
      onCreate({
        username: username.trim(),
        password: password.trim()
      });
      setUsername('');
      setPassword('');
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[#1C2029] border border-purple-500/30">
      <div className="flex items-center space-x-2 mb-4">
        <UserPlus className="w-5 h-5 text-purple-400" />
        <h3 className="font-medium text-white">Create New Caller</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50 text-gray-300 focus:outline-none focus:border-purple-500/50"
            placeholder="Enter username"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Password</label>
            <button
              type="button"
              onClick={() => {
                setAutoGenerate(!autoGenerate);
                if (!autoGenerate) {
                  setPassword(generatePassword());
                }
              }}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {autoGenerate ? 'Manual' : 'Generate'}
            </button>
          </div>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50 text-gray-300 focus:outline-none focus:border-purple-500/50"
            placeholder={autoGenerate ? 'Auto-generated' : 'Enter password'}
            required
            readOnly={autoGenerate}
          />
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <button
            type="submit"
            className="flex-1 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
          >
            Create Caller
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default function Callers() {
  const { callers, addCaller, updateCaller, deleteCaller } = useAdminSocket();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreate = (callerData) => {
    addCaller(callerData);
    setShowCreateForm(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this caller account?')) {
      deleteCaller(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative rounded-xl overflow-hidden bg-[#161A22] border border-gray-800/50">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-medium text-gray-300 flex items-center space-x-2">
                <Phone className="w-5 h-5 text-purple-400" />
                <span>Caller Management</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create and manage caller accounts with restricted access
              </p>
            </div>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Caller</span>
              </button>
            )}
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
              <div className="text-xs text-purple-300">
                <p>Callers have restricted access:</p>
                <ul className="list-disc list-inside mt-1 text-purple-400/80">
                  <li>Can view dashboard and sessions</li>
                  <li>Cannot access settings</li>
                  <li>Cannot ban IPs or remove sessions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateCallerForm
          onCreate={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Callers Grid */}
      {callers && callers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {callers.map((caller) => (
            <CallerCard
              key={caller.id}
              caller={caller}
              onDelete={handleDelete}
              onUpdate={updateCaller}
            />
          ))}
        </div>
      ) : (
        !showCreateForm && (
          <div className="text-center py-12 rounded-xl bg-[#161A22] border border-gray-800/50">
            <Phone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No caller accounts yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
            >
              Create First Caller
            </button>
          </div>
        )
      )}
    </div>
  );
}