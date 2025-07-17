import React, { useState } from 'react';
import './OAuthDialog.css';
import { useToast } from './Toast';

interface OAuthDialogProps {
  isOpen: boolean;
  authUrl: string;
  onComplete: (authCode: string) => void;
  onCancel: () => void;
  brokerName: string;
}

export const OAuthDialog: React.FC<OAuthDialogProps> = ({
  isOpen,
  authUrl,
  onComplete,
  onCancel,
  brokerName
}) => {
  const [authCode, setAuthCode] = useState('');
  const [step, setStep] = useState(1);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (authCode.trim()) {
      onComplete(authCode.trim());
    }
  };

  const handleOpenUrl = () => {
    window.open(authUrl, '_blank');
    setStep(2);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(authUrl);
      showToast({
        type: 'success',
        title: 'URL Copied!',
        message: 'Authentication URL has been copied to clipboard.',
        duration: 3000
      });
    } catch (err) {
      console.error('Failed to copy URL:', err);
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy URL to clipboard.',
        duration: 3000
      });
    }
  };

  return (
    <div className="oauth-dialog-overlay">
      <div className="oauth-dialog">
        <div className="oauth-dialog-header">
          <h3>🔐 {brokerName} Authentication</h3>
          <button className="oauth-dialog-close" onClick={onCancel}>×</button>
        </div>

        <div className="oauth-dialog-content">
          <div className="oauth-steps">
            <div className={`oauth-step ${step >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Open Authentication Page</h4>
                <p>Click the button below to open {brokerName} authentication in a new tab:</p>
                <div className="oauth-url-section">
                  <div className="oauth-url">
                    {authUrl}
                  </div>
                  <div className="oauth-url-actions">
                    <button 
                      className="btn btn-primary"
                      onClick={handleOpenUrl}
                    >
                      🔗 Open in New Tab
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={copyToClipboard}
                    >
                      📋 Copy URL
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`oauth-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Complete Authentication</h4>
                <p>
                  In the new tab, log in to your {brokerName} account and authorize the application.
                  After successful authentication, you'll see a URL containing <code>code=</code>.
                </p>
              </div>
            </div>

            <div className={`oauth-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Enter Authorization Code</h4>
                <p>Copy the authorization code from the URL and paste it below:</p>
                <div className="oauth-input-section">
                  <input
                    type="text"
                    className="form-input oauth-code-input"
                    placeholder="Paste authorization code here..."
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    disabled={step < 2}
                  />
                  <div className="oauth-input-help">
                    Look for <code>code=XXXXXXXX</code> in the URL and copy the value after <code>code=</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="oauth-dialog-footer">
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={!authCode.trim()}
          >
            ✅ Complete Authentication
          </button>
        </div>
      </div>
    </div>
  );
};
