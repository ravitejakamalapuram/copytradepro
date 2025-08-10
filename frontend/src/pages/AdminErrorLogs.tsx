import React from 'react';
import AppNavigation from '../components/AppNavigation';
import ErrorLoggingHealthMonitor from '../components/ErrorLoggingHealthMonitor';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack } from '../components/ui/Layout';
import '../styles/app-theme.css';

const AdminErrorLogs: React.FC = () => {
  return (
    <div className="app-theme app-layout">
      <AppNavigation />

      <div className="app-main">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Error Logs & System Health
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)',
            fontSize: '1rem'
          }}>
            Monitor error logging system health and manage error queues
          </p>
        </div>

        <Stack gap={6}>
          {/* Error Logging Health Monitor */}
          <Card>
            <CardHeader>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                Error Logging System Health
              </h2>
            </CardHeader>
            <CardContent>
              <ErrorLoggingHealthMonitor />
            </CardContent>
          </Card>

          {/* Additional Error Management Tools */}
          <Card>
            <CardHeader>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                Error Management Tools
              </h2>
            </CardHeader>
            <CardContent>
              <div style={{ 
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <p>Additional error management tools will be available here:</p>
                <ul style={{ 
                  listStyle: 'none',
                  padding: 0,
                  marginTop: '1rem'
                }}>
                  <li>• Error log search and filtering</li>
                  <li>• Error pattern analysis</li>
                  <li>• Automated error resolution</li>
                  <li>• Error notification settings</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </Stack>
      </div>
    </div>
  );
};

export default AdminErrorLogs;