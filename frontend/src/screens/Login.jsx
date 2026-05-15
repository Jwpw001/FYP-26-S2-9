import React, { useState } from 'react';
import Button from '../components/Button';

export default function Login({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 700);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

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
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="login-demo">Demo: use any email &amp; password</div>
      </div>
    </div>
  );
}
