import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

export default function Login({ onLogin }) {
  const { login, loading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [demoMode, setDemoMode] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    const result = await login(email, password);
    if (result.success) {
      if (result.demo) setDemoMode(true);
      onLogin(result.role);
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-mark">
            <i className="ti ti-calendar-event" aria-hidden="true" />
          </div>
          <span className="login-logo-text">Krewby</span>
        </div>

        <div className="login-title">Sign in to your account</div>
        <div className="login-sub">Workforce scheduling &amp; smart assignment</div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red)', border: '0.5px solid var(--red-b)',
            borderRadius: 8, padding: '9px 12px', marginBottom: 14,
            fontSize: 13, color: 'var(--red-t)', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <i className="ti ti-alert-circle" />
            {error}
          </div>
        )}

        {/* Demo mode notice */}
        {demoMode && (
          <div style={{
            background: 'var(--amber)', borderRadius: 8, padding: '9px 12px',
            marginBottom: 14, fontSize: 12, color: 'var(--amber-t)',
          }}>
            <i className="ti ti-wifi-off" style={{ marginRight: 5 }} />
            Backend offline — running in demo mode with mock data.
          </div>
        )}

        {/* Email */}
        <div className="form-group">
          <label className="form-label">Email address</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@outlet.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
        </div>

        <div className="login-forgot">
          <span>Forgot password?</span>
        </div>

        <Button
          variant="primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleLogin}
        >
          {loading
            ? <><i className="ti ti-loader-2" style={{ animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
            : 'Sign in'
          }
        </Button>

        <div className="login-demo" style={{ marginTop: 16 }}>
          Demo: any email &amp; password works while backend is in development
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
