import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes, applyTheme, initializeTheme } from '../themes/themeConfig';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('lunar');

  useEffect(() => {
    // Initialize theme on mount
    const savedTheme = initializeTheme();
    setCurrentTheme(savedTheme);
  }, []);

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      applyTheme(themeName);
      setCurrentTheme(themeName);
    }
  };

  const value = {
    currentTheme,
    changeTheme,
    themes: Object.keys(themes).map(key => ({
      id: key,
      name: themes[key].name
    }))
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}