import React, { useState, useEffect } from 'react';
import { AdminSocketProvider, useAdminSocket } from './contexts/AdminSocket';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Dashboard from './components/Dashboard';
import SessionList from './components/SessionList';
import Settings from './components/Settings';
import Callers from './components/Callers';
import BannedIPs from './components/BannedIPs';
import LoginPage from './pages/LoginPage';
import MacOSLayout from './components/MacOSLayout';
import { LogOut } from 'lucide-react';
import './styles/themes.css';

const AppContent = () => {
  const { isConnected } = useAdminSocket();
  const { isAuthenticated, logout, userRole } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isAppearing, setIsAppearing] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('Gemini');

  useEffect(() => {
    if (isAuthenticated) {
      setTimeout(() => setIsAppearing(true), 300);
    } else {
      setIsAppearing(false);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-page-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold theme-text-primary mb-2">Connecting to server...</h1>
          <p className="theme-text-secondary">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  return (
    <MacOSLayout activeView={activeView} onViewChange={setActiveView}>
      <div className={`
        transition-all duration-700 ease-out
        ${isAppearing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}>
        {/* Breadcrumb Header */}
        <div className="px-8 py-6 border-b border-gray-800/50 bg-[#0F1117]">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-white">Overview</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6">
          {activeView === 'dashboard' ? (
            <div className="space-y-6">
              <Dashboard selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} />
              <SessionList selectedBrand={selectedBrand} userRole={userRole} />
            </div>
          ) : activeView === 'settings' ? (
            <div className="space-y-6">
              <Settings />
            </div>
          ) : activeView === 'callers' ? (
            <div className="space-y-6">
              <Callers />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <p className="text-lg">{activeView} section coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MacOSLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminSocketProvider>
          <AppContent />
        </AdminSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}