import React from 'react';
import { useThemeStore, Theme } from '../stores/themeStore';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  showLabel = false 
}) => {
  const { theme, setTheme, isDark } = useThemeStore();

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Theme:
        </span>
      )}
      
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {themes.map((themeOption) => (
          <button
            key={themeOption.value}
            onClick={() => handleThemeChange(themeOption.value)}
            className={`
              flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200
              ${theme === themeOption.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
            title={`Switch to ${themeOption.label} theme`}
          >
            <span className="text-sm">{themeOption.icon}</span>
            <span className="hidden sm:inline">{themeOption.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const SimpleThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toggleTheme, isDark } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800
        ${className}
      `}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <span className="text-lg">☀️</span>
      ) : (
        <span className="text-lg">🌙</span>
      )}
    </button>
  );
};
