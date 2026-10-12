import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiMail, FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../App';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      login(token, user);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      let demoEmail = process.env.REACT_APP_DEMO_EMAIL || '';
      let demoPassword = process.env.REACT_APP_DEMO_PASSWORD || '';
      if (!demoEmail || !demoPassword) {
        const response = await api.get('/auth/demo-credentials');
        demoEmail = response.data?.email || '';
        demoPassword = response.data?.password || '';
      }
      if (!demoEmail || !demoPassword) throw new Error('Demo credentials are not configured');
      setEmail(demoEmail);
      setPassword(demoPassword);
      toast.info('Demo credentials filled. Review them, then sign in.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Demo credentials are not enabled for this environment');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="icon"><FiShield /></div>
            <h2>Anti-Fraud AI Engine</h2>
            <p>Sign in to access the dashboard</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button type="button" className="btn-quick" disabled={loading || demoLoading} onClick={fillDemoCredentials}>
              {demoLoading ? 'Loading Demo Credentials...' : 'Fill Demo Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
