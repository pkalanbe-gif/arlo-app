import { useState, useRef } from 'react';
import { useArlo } from '../context/ArloContext';

export default function Login() {
  const { login, getFactors, startAuth, finishAuth, loading, error, setError } = useArlo();

  const [step, setStep] = useState('login'); // 'login' | 'factors' | 'otp'

  // Uncontrolled refs — lets browser autofill work freely
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

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

    // Always read from DOM directly (uncontrolled inputs)
    const emailVal = emailRef.current?.value?.trim() || '';
    const passwordVal = passwordRef.current?.value || '';

    console.log('[Login] handleLogin called, email:', emailVal.length, 'chars, password:', passwordVal.length, 'chars');

    if (!emailVal || !passwordVal) {
      setError('Mete email ak password ou');
      return;
    }
    setError(null);

    const result = await login(emailVal, passwordVal);
    console.log('[Login] login result:', JSON.stringify(result));
    if (!result || result.success === false) return;

    if (result.step === 'done') {
      return;
    }

    if (result.step === '2fa-factors') {
      console.log('[Login] 2FA required');
      setTempToken(result.token);
      setTempUserId(result.userId);

      if (result.factors && result.factors.length > 0) {
        console.log('[Login] Factors from login response:', result.factors.length);
        setFactors(result.factors);
        setStep('factors');
        return;
      }

      console.log('[Login] Fetching factors separately...');
      const factorResult = await getFactors(result.token, result.userId);
      console.log('[Login] getFactors result:', JSON.stringify(factorResult));
      if (factorResult && factorResult.success && factorResult.factors) {
        setFactors(factorResult.factors);
        setStep('factors');
      } else {
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

  // ─── Step: Login Form (UNCONTROLLED inputs for autofill compatibility) ───
  return (
    <div className="login-page">
      <div className="login-logo">📷</div>
      <h1 className="login-title">Arlo Cam</h1>
      <p className="login-subtitle">Konekte ak kont Arlo ou pou kontwole kamera ou</p>

      <form className="login-form" onSubmit={handleLogin} noValidate>
        {error && <div className="error-msg">{error}</div>}

        <div className="input-group">
          <label>Email</label>
          <input
            ref={emailRef}
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            name="email"
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            ref={passwordRef}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            name="password"
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
