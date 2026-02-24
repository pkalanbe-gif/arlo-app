import { useState } from 'react';
import { useArlo } from '../context/ArloContext';

export default function Login() {
  const { login, getFactors, startAuth, finishAuth, loading, error, setError } = useArlo();

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('login'); // 'login' | 'factors' | 'otp'

  // 2FA state
  const [tempToken, setTempToken] = useState(null);
  const [tempUserId, setTempUserId] = useState(null);
  const [factors, setFactors] = useState([]);
  const [selectedFactor, setSelectedFactor] = useState(null);
  const [factorAuthCode, setFactorAuthCode] = useState(null);
  const [otp, setOtp] = useState('');

  // ─── Step 1: Login with email/password ───
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Mete email ak password ou');
      return;
    }
    setError(null);

    const result = await login(email, password);
    console.log('[Login] login result:', JSON.stringify(result));
    if (!result || result.success === false) return;

    if (result.step === 'done') {
      // Fully authenticated
      return;
    }

    if (result.step === '2fa-factors') {
      // Need 2FA — get factors
      console.log('[Login] 2FA required, getting factors...');
      setTempToken(result.token);
      setTempUserId(result.userId);

      const factorResult = await getFactors(result.token, result.userId);
      console.log('[Login] getFactors result:', JSON.stringify(factorResult));
      if (factorResult && factorResult.success && factorResult.factors) {
        setFactors(factorResult.factors);
        setStep('factors');
      } else {
        // getFactors failed — show error
        console.error('[Login] getFactors failed:', factorResult);
        setError(factorResult?.error || 'Pa ka jwenn opsyon verifikasyon. Eseye ankò.');
      }
    }
  };

  // ─── Step 2: Select a factor and send code ───
  const handleSelectFactor = async (factor) => {
    setError(null);
    setSelectedFactor(factor);

    const result = await startAuth(tempToken, factor.factorId, tempUserId);
    if (result && result.success) {
      setFactorAuthCode(result.factorAuthCode);
      setStep('otp');
    }
  };

  // ─── Step 3: Submit OTP code ───
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError('Mete kòd verifikasyon an');
      return;
    }
    setError(null);

    await finishAuth(tempToken, factorAuthCode, otp);
    // If successful, ArloContext sets token and redirects
  };

  // ─── Step: Factor Selection ───
  if (step === 'factors') {
    return (
      <div className="login-page">
        <div className="login-logo">🔐</div>
        <h1 className="login-title">Verifikasyon</h1>
        <p className="login-subtitle">Chwazi kòman ou vle resevwa kòd la</p>

        <div className="login-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="factors-list">
            {factors.map((f, i) => (
              <button
                key={f.factorId || i}
                type="button"
                className="btn btn-factor"
                disabled={loading}
                onClick={() => handleSelectFactor(f)}
              >
                {f.factorType === 'EMAIL' && '📧'}
                {f.factorType === 'SMS' && '📱'}
                {f.factorType === 'PUSH' && '🔔'}
                {' '}
                {f.factorType === 'EMAIL' ? 'Voye kòd pa Email' :
                 f.factorType === 'SMS' ? 'Voye kòd pa SMS' :
                 f.factorType === 'PUSH' ? 'Notifikasyon Push' :
                 f.displayName || f.factorType}
              </button>
            ))}
          </div>

          {loading && <p className="loading-text">⏳ Ap voye kòd la...</p>}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '16px' }}
            onClick={() => { setStep('login'); setError(null); }}
          >
            ← Retounen
          </button>
        </div>
      </div>
    );
  }

  // ─── Step: OTP Input ───
  if (step === 'otp') {
    return (
      <div className="login-page">
        <div className="login-logo">🔑</div>
        <h1 className="login-title">Antre Kòd la</h1>
        <p className="login-subtitle">
          {selectedFactor?.factorType === 'EMAIL'
            ? 'Tcheke imel ou pou kòd verifikasyon an'
            : selectedFactor?.factorType === 'SMS'
            ? 'Tcheke SMS ou pou kòd verifikasyon an'
            : 'Antre kòd verifikasyon an'}
        </p>

        <form className="login-form" onSubmit={handleVerifyOtp}>
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
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Ap verifye...' : '✓ Verifye Kòd'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '12px' }}
            onClick={() => { setStep('factors'); setOtp(''); setError(null); }}
          >
            ← Chanje metòd verifikasyon
          </button>
        </form>
      </div>
    );
  }

  // ─── Step: Login Form ───
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
