import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    return '🌓'; // auto
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light';
    if (theme === 'dark') return 'Dark';
    return 'Auto';
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className={className}
      title={`Current theme: ${getThemeLabel()}. Click to cycle through themes.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        minWidth: '80px'
      }}
    >
      <span style={{ fontSize: '1rem' }}>{getThemeIcon()}</span>
      <span style={{ fontSize: '0.75rem' }}>{getThemeLabel()}</span>
    </Button>
  );
};

export const ColorSchemeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { colorScheme, setColorScheme } = useTheme();

  const schemes = [
    { key: 'blue', label: 'Blue', color: '#3b82f6' },
    { key: 'green', label: 'Green', color: '#10b981' },
    { key: 'purple', label: 'Purple', color: '#8b5cf6' },
    { key: 'orange', label: 'Orange', color: '#f59e0b' }
  ] as const;

  return (
    <div className={`color-scheme-selector ${className}`} style={{
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      <span style={{ 
        fontSize: '0.75rem', 
        color: 'var(--text-secondary)',
        marginRight: '0.25rem'
      }}>
        Theme:
      </span>
      {schemes.map((scheme) => (
        <button
          key={scheme.key}
          onClick={() => setColorScheme(scheme.key)}
          title={`Switch to ${scheme.label} theme`}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: scheme.color,
            border: colorScheme === scheme.key ? '2px solid var(--text-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: colorScheme === scheme.key ? '0 0 0 2px var(--bg-primary)' : 'none'
          }}
        />
      ))}
    </div>
  );
};