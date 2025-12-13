export const themes = {
  lunar: {
    name: 'Lunar',
    colors: {
      // Background colors
      pageBg: '#0F1014',
      primaryBg: '#161A22',
      secondaryBg: '#1C2029',
      tertiaryBg: '#1A1A1A',

      // Border colors
      borderPrimary: 'rgba(128, 128, 128, 0.125)', // gray-800/50
      borderSecondary: 'rgba(255, 255, 255, 0.06)',
      borderAccent: 'rgba(59, 130, 246, 0.3)', // blue-500/30

      // Text colors
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255, 255, 255, 0.6)',
      textMuted: 'rgba(255, 255, 255, 0.4)',

      // Accent colors
      accent: '#3B82F6', // blue-500
      accentHover: '#2563EB', // blue-600
      accentBg: 'rgba(59, 130, 246, 0.1)', // blue-500/10

      // Status colors
      success: '#10B981', // green-500
      successBg: 'rgba(16, 185, 129, 0.1)',
      warning: '#F59E0B', // yellow-500
      warningBg: 'rgba(245, 158, 11, 0.1)',
      danger: '#EF4444', // red-500
      dangerBg: 'rgba(239, 68, 68, 0.1)',
      purple: '#A855F7', // purple-500
      purpleBg: 'rgba(168, 85, 247, 0.1)',

      // Hover states
      hoverBg: 'rgba(255, 255, 255, 0.08)',
      hoverBorder: 'rgba(255, 255, 255, 0.2)',

      // Gradients
      gradientFrom: 'rgba(59, 130, 246, 0.05)',
      gradientTo: 'transparent',
    }
  },

  halloween: {
    name: 'Halloween',
    colors: {
      // Background colors - Dark with purple/orange tints
      pageBg: '#0A0008',
      primaryBg: '#1A0F1A',
      secondaryBg: '#251528',
      tertiaryBg: '#15101A',

      // Border colors
      borderPrimary: 'rgba(255, 140, 0, 0.15)', // orange
      borderSecondary: 'rgba(147, 51, 234, 0.1)', // purple
      borderAccent: 'rgba(255, 140, 0, 0.4)',

      // Text colors
      textPrimary: '#FFE4E1',
      textSecondary: 'rgba(255, 200, 150, 0.7)',
      textMuted: 'rgba(255, 180, 120, 0.5)',

      // Accent colors - Orange and Purple
      accent: '#FF8C00', // dark orange
      accentHover: '#FF6500',
      accentBg: 'rgba(255, 140, 0, 0.15)',

      // Status colors with Halloween twist
      success: '#9333EA', // purple-600
      successBg: 'rgba(147, 51, 234, 0.15)',
      warning: '#FF8C00', // orange
      warningBg: 'rgba(255, 140, 0, 0.15)',
      danger: '#DC2626', // red-600
      dangerBg: 'rgba(220, 38, 38, 0.15)',
      purple: '#9333EA',
      purpleBg: 'rgba(147, 51, 234, 0.15)',

      // Hover states
      hoverBg: 'rgba(255, 140, 0, 0.08)',
      hoverBorder: 'rgba(255, 140, 0, 0.3)',

      // Gradients - Orange to purple
      gradientFrom: 'rgba(255, 140, 0, 0.1)',
      gradientTo: 'rgba(147, 51, 234, 0.05)',
    }
  },

  fall: {
    name: 'Fall',
    colors: {
      // Background colors - Warm earth tones
      pageBg: '#0F0A08',
      primaryBg: '#1F1612',
      secondaryBg: '#2A1F18',
      tertiaryBg: '#1A1410',

      // Border colors - Autumn colors
      borderPrimary: 'rgba(217, 119, 6, 0.2)', // amber
      borderSecondary: 'rgba(194, 65, 12, 0.15)', // orange
      borderAccent: 'rgba(217, 119, 6, 0.4)',

      // Text colors - Warm whites
      textPrimary: '#FEF3C7',
      textSecondary: 'rgba(251, 191, 36, 0.8)',
      textMuted: 'rgba(245, 158, 11, 0.6)',

      // Accent colors - Amber and brown
      accent: '#D97706', // amber-600
      accentHover: '#B45309',
      accentBg: 'rgba(217, 119, 6, 0.15)',

      // Status colors with autumn theme
      success: '#65A30D', // lime-600
      successBg: 'rgba(101, 163, 13, 0.15)',
      warning: '#F59E0B', // amber-500
      warningBg: 'rgba(245, 158, 11, 0.15)',
      danger: '#DC2626',
      dangerBg: 'rgba(220, 38, 38, 0.15)',
      purple: '#A855F7',
      purpleBg: 'rgba(168, 85, 247, 0.15)',

      // Hover states
      hoverBg: 'rgba(217, 119, 6, 0.08)',
      hoverBorder: 'rgba(217, 119, 6, 0.3)',

      // Gradients - Golden autumn
      gradientFrom: 'rgba(217, 119, 6, 0.08)',
      gradientTo: 'rgba(194, 65, 12, 0.03)',
    }
  },

  christmas: {
    name: 'Christmas',
    colors: {
      // Background colors - Deep festive tones
      pageBg: '#0A0F0A',
      primaryBg: '#0F1A0F',
      secondaryBg: '#1A251A',
      tertiaryBg: '#141A14',

      // Border colors - Red and green
      borderPrimary: 'rgba(220, 38, 38, 0.2)', // red
      borderSecondary: 'rgba(34, 197, 94, 0.15)', // green
      borderAccent: 'rgba(220, 38, 38, 0.4)',

      // Text colors - Snow white
      textPrimary: '#FAFAFA',
      textSecondary: 'rgba(248, 250, 252, 0.8)',
      textMuted: 'rgba(241, 245, 249, 0.6)',

      // Accent colors - Christmas red and green
      accent: '#DC2626', // red-600
      accentHover: '#B91C1C',
      accentBg: 'rgba(220, 38, 38, 0.15)',

      // Status colors with festive theme
      success: '#16A34A', // green-600
      successBg: 'rgba(22, 163, 74, 0.15)',
      warning: '#FCD34D', // golden yellow
      warningBg: 'rgba(252, 211, 77, 0.15)',
      danger: '#DC2626',
      dangerBg: 'rgba(220, 38, 38, 0.15)',
      purple: '#A855F7',
      purpleBg: 'rgba(168, 85, 247, 0.15)',

      // Hover states
      hoverBg: 'rgba(220, 38, 38, 0.08)',
      hoverBorder: 'rgba(220, 38, 38, 0.3)',

      // Gradients - Red to green festive
      gradientFrom: 'rgba(220, 38, 38, 0.08)',
      gradientTo: 'rgba(34, 197, 94, 0.03)',
    }
  }
};

export const getTheme = (themeName) => {
  return themes[themeName] || themes.lunar;
};

// CSS variable generator
export const applyTheme = (themeName) => {
  const theme = getTheme(themeName);
  const root = document.documentElement;

  Object.entries(theme.colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variables
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });

  // Store theme preference
  localStorage.setItem('adminTheme', themeName);
};

// Initialize theme on load
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem('adminTheme') || 'lunar';
  applyTheme(savedTheme);
  return savedTheme;
};