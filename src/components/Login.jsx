import { useState } from 'react';
import { useArlo } from '../context/ArloContext';

export default function Login() {
  const { login, verify2FA, loading, error, setError } = useArlo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [tempToken, setTempToken] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [otp, setOtp] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Mete email ak password ou');
      return;
    }
    setError(null);
    try {
      const result = await login(email, password);
      if (result && result.step === '2fa') {
        setStep('2fa');
        setTempToken(result.token);
        setFactorId(result.factorId);
      }
    } catch (err) {
      // Error set in context, add fallback just in case
      console.error('Login error:', err);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await verify2FA(tempToken, otp, factorId);
    } catch (err) {
      // Error already set in context
    }
  };

  if (step === '2fa') {
    return (
      <div className="login-page">
        <div className="login-logo">🔐</div>
        <h1 className="login-title">Verifikasyon 2FA</h1>
        <p className="login-subtitle">Antre kòd verifikasyon ki nan imel/SMS ou</p>

        <form className="login-form" onSubmit={handleVerify}>
          {error && <div className="error-msg">{error}</div>}

          <div className="input-group">
            <label>Kòd Verifikasyon</label>
            <input
              type="text"
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Ap verifye...' : '✓ Verifye'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '12px' }}
            onClick={() => { setStep('login'); setOtp(''); setError(null); }}
          >
            ← Retounen
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-logo">📷</div>
      <h1 className="login-title">Arlo Cam</h1>
      <p className="login-subtitle">Konekte ak kont Arlo ou pou kontwole kamera ou</p>

      <form className="login-form" onSubmit={handleLogin}>
        {error && <div className="error-msg">{error}</div>}

        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '⏳ Ap konekte...' : '🔓 Konekte'}
        </button>
      </form>

      <p style={{ marginTop: '24px', color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center' }}>
        Itilize menm email/password kont Arlo ou
      </p>
    </div>
  );
}
