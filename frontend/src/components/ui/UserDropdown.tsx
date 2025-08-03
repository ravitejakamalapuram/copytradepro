import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';


interface UserDropdownProps {
  className?: string;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Regular menu items
  const regularMenuItems = [
    {
      icon: '👤',
      label: 'Profile',
      onClick: () => {
        navigate('/profile');
        setIsOpen(false);
      }
    },
    {
      icon: '⚙️',
      label: 'Settings',
      onClick: () => {
        navigate('/settings');
        setIsOpen(false);
      }
    },
    {
      icon: '📊',
      label: 'Analytics',
      onClick: () => {
        navigate('/portfolio-analytics');
        setIsOpen(false);
      }
    },
    {
      icon: '🔔',
      label: 'Notifications',
      onClick: () => {
        navigate('/alerts');
        setIsOpen(false);
      }
    },
    {
      icon: '❓',
      label: 'Help & Support',
      onClick: () => {
        navigate('/help');
        setIsOpen(false);
      }
    }
  ];

  // Admin-specific menu items
  const adminMenuItems = [
    {
      icon: '🛡️',
      label: 'Admin Panel',
      onClick: () => {
        navigate('/admin');
        setIsOpen(false);
      }
    },
    {
      icon: '👥',
      label: 'User Management',
      onClick: () => {
        navigate('/admin/users');
        setIsOpen(false);
      }
    },
    {
      icon: '🐛',
      label: 'Error Logs',
      onClick: () => {
        navigate('/admin/error-logs');
        setIsOpen(false);
      }
    },
    {
      icon: '💚',
      label: 'System Health',
      onClick: () => {
        navigate('/admin/system-health');
        setIsOpen(false);
      }
    },
    {
      icon: '📊',
      label: 'Admin Analytics',
      onClick: () => {
        navigate('/admin/analytics');
        setIsOpen(false);
      }
    }
  ];

  // Logout item
  const logoutItem = {
    icon: '🚪',
    label: 'Logout',
    onClick: handleLogout,
    danger: true
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`user-dropdown ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          backgroundColor: isOpen ? 'var(--bg-tertiary)' : 'transparent',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontSize: '0.875rem'
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--interactive-primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}
        >
          {user?.name ? getInitials(user.name) : 'U'}
        </div>

        {/* User Info */}
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
            {user?.name || 'User'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {user?.email || 'user@example.com'}
          </div>
        </div>

        {/* Dropdown Arrow */}
        <div
          style={{
            marginLeft: '0.25rem',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}
        >
          ▼
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            minWidth: '220px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* User Info Header */}
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-secondary)',
              backgroundColor: 'var(--bg-tertiary)'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {user?.email || 'user@example.com'}
            </div>
          </div>

          {/* Regular Menu Items */}
          <div style={{ padding: '0.5rem' }}>
            {regularMenuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <>
              <div style={{
                height: '1px',
                backgroundColor: 'var(--border-secondary)',
                margin: '0.5rem 0'
              }} />
              <div style={{
                padding: '0.5rem 1rem 0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Administration
              </div>
              <div style={{ padding: '0.25rem 0.5rem 0.5rem' }}>
                {adminMenuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={item.onClick}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Logout Section */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-secondary)',
            margin: '0.5rem 0'
          }} />
          <div style={{ padding: '0.5rem' }}>
            <button
              onClick={logoutItem.onClick}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                color: 'var(--color-loss)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '1rem' }}>{logoutItem.icon}</span>
              <span>{logoutItem.label}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};