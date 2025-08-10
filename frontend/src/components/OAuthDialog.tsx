import React, { useState } from 'react';
import './OAuthDialog.css';
import { useToast } from './Toast';

interface OAuthDialogProps {
  isOpen: boolean;
  authUrl: string;
  onComplete: (authCode: string, fullUrl?: string) => void;
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
  const [fullUrl, setFullUrl] = useState('');
  const [step, setStep] = useState(1);
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);

  // Bookmarklet link to help auto-copy code from the redirected page
  const bookmarkletLink = "javascript:(()=>{try{const u=new URL(location.href);const code=u.searchParams.get('code');const state=u.searchParams.get('state');if(!code){alert('No ?code found in URL');return;}navigator.clipboard.writeText(code).then(()=>alert('Copied code: '+code+(state?' (state: '+state+')':''))).catch(err=>alert('Copy failed: '+err));}catch(e){alert('Failed to parse URL: '+e);}})()";

  if (!isOpen) return null;

  const handleSubmit = () => {
    // If a full URL was pasted, pass it to onComplete so caller can parse code/state
    if (fullUrl.trim()) {
      onComplete(authCode.trim() || fullUrl.trim(), fullUrl.trim());
      return;
    }
    if (authCode.trim()) {
      onComplete(authCode.trim());
    }
  };

  const handleOpenUrl = (e?: React.MouseEvent) => {
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (opening) {
        return;
      }
      setOpening(true);
      // Allow user to proceed even if popup is blocked or they prefer manual paste
      setStep(2);
      const newWin = window.open(authUrl, 'copytrade_oauth', 'noopener,noreferrer');
      if (newWin) {
        newWin.opener = null;
        setStep(2);
        return;
      }
      // If popup was blocked, notify the user to click the link below manually
      showToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'Your browser blocked the popup. Click the URL link below to open authentication in a new tab.',
        duration: 4000
      });
    } catch (err) {
      console.error('Failed to open auth URL:', err);
      showToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'We could not open the authentication page automatically. Use the Copy URL button or the link below to open it manually.',
        duration: 4000
      });
    } finally {
      // Re-enable after a short delay to guard against accidental double clicks
      setTimeout(() => { setOpening(false); }, 1500);
    }
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
                    <div className="oauth-url" style={{ wordBreak: 'break-all' }}>
                      {authUrl}
                    </div>
                  </div>
                  <div className="oauth-url-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onMouseDown={(e) => handleOpenUrl(e)}
                      onDoubleClick={(e) => e.preventDefault()}
                      onAuxClick={(e) => e.preventDefault()}
                      disabled={opening}
                      aria-busy={opening}
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
                <p>Paste either the full redirected URL (recommended) or just the code:</p>
                <div className="oauth-input-section" style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="url"
                    className="form-input oauth-code-input"
                    placeholder="Paste full redirected URL here (contains ?code=...)"
                    value={fullUrl}
                    onChange={(e) => setFullUrl(e.target.value)}
                  />
                  <div className="oauth-input-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text?.startsWith('http')) {
                            setFullUrl(text);
                            showToast({ type: 'success', title: 'Pasted from Clipboard', message: 'Full URL inserted from clipboard.' });
                          } else if (text) {
                            setAuthCode(text);
                            showToast({ type: 'success', title: 'Pasted Code', message: 'Authorization code inserted from clipboard.' });
                          } else {
                            showToast({ type: 'warning', title: 'Clipboard Empty', message: 'Nothing to paste from clipboard.' });
                          }
                        } catch (e) {
                          console.error('Clipboard read failed:', e);
                          showToast({ type: 'error', title: 'Clipboard Error', message: 'Could not read from clipboard. Paste manually.' });
                        }
                      }}
                    >
                      📋 Paste from Clipboard
                    </button>
                    <div className="oauth-input-help" style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      We will extract code (and state) automatically from the URL.
                    </div>
                  </div>
                </div>
                <div className="oauth-helper" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <span style={{ marginRight: '0.25rem' }}>ℹ️</span>
                  Tip: After you login/authorize on {brokerName}, you'll be redirected to your configured Redirect URL. Copy the full URL from the browser address bar (it includes <code>?code=</code> and optionally <code>state=</code>) and paste it here.
                </div>
                <div className="oauth-bookmarklet" style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    Optional: Drag this to your bookmarks bar for faster copying on the redirect page:
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <a
                      href={bookmarkletLink}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-secondary)', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      🔖 Copy OAuth Code
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigator.clipboard.writeText(bookmarkletLink).then(() => showToast({ type: 'success', title: 'Copied', message: 'Bookmarklet copied to clipboard.'})).catch(() => showToast({ type: 'error', title: 'Copy failed', message: 'Could not copy the bookmarklet.'}))}
                    >
                      📋 Copy Bookmarklet
                    </button>
                  </div>
                </div>
                <div className="oauth-input-section">
                  <input
                    type="text"
                    className="form-input oauth-code-input"
                    placeholder="Or paste authorization code here..."
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
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
            disabled={!authCode.trim() && !fullUrl.trim()}
          >
            ✅ Complete Authentication
          </button>
        </div>
      </div>
    </div>
  );
};
