import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const ArloContext = createContext(null);

export function ArloProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('arlo_token') || null);
  const [userId, setUserId] = useState(localStorage.getItem('arlo_user') || null);
  const [devices, setDevices] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [baseStations, setBaseStations] = useState([]);
  const [currentMode, setCurrentMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLoggedIn = !!token;

  // ─── Step 1: Login (email/password → get temp token) ───
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      if (result.success === false) {
        setError(result.error || 'Login echwe');
        return result;
      }
      // If fully authenticated (rare, usually needs 2FA)
      if (result.success && result.step === 'done') {
        setToken(result.token);
        setUserId(result.userId);
        localStorage.setItem('arlo_token', result.token);
        localStorage.setItem('arlo_user', result.userId);
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erè koneksyon';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Get 2FA factors ───
  const getFactors = async (tempToken, tempUserId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getFactors(tempToken, tempUserId);
      if (result.success === false) {
        setError(result.error || 'Pa ka jwenn opsyon verifikasyon');
        return result;
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erè koneksyon';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Start 2FA (send code) ───
  const startAuth = async (tempToken, factorId, tempUserId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.startAuth(tempToken, factorId, tempUserId);
      if (result.success === false) {
        setError(result.error || 'Pa ka voye kòd verifikasyon');
        return result;
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erè koneksyon';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 4: Finish 2FA (validate OTP) ───
  const finishAuth = async (tempToken, factorAuthCode, otp) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.finishAuth(tempToken, factorAuthCode, otp);
      if (result.success === false) {
        setError(result.error || 'Kòd verifikasyon pa bon');
        return result;
      }
      if (result.success && result.step === 'done') {
        setToken(result.token);
        setUserId(result.userId);
        localStorage.setItem('arlo_token', result.token);
        localStorage.setItem('arlo_user', result.userId);
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erè koneksyon';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setToken(null);
    setUserId(null);
    setDevices([]);
    setCameras([]);
    setBaseStations([]);
    localStorage.removeItem('arlo_token');
    localStorage.removeItem('arlo_user');
  };

  // Load devices
  const loadDevices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.getDevices();
      if (result.success) {
        setDevices(result.devices || []);
        setCameras(result.cameras || []);
        setBaseStations(result.baseStations || []);
      }
    } catch (err) {
      setError('Pa ka jwenn aparèy yo');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Set mode
  const changeMode = async (deviceId, xCloudId, mode) => {
    setLoading(true);
    try {
      const result = await api.setMode(deviceId, xCloudId, mode);
      setCurrentMode(mode);
      return result;
    } catch (err) {
      setError('Pa ka chanje mòd la');
    } finally {
      setLoading(false);
    }
  };

  // Take snapshot
  const takeSnapshot = async (deviceId, parentId, xCloudId) => {
    try {
      return await api.takeSnapshot(deviceId, parentId, xCloudId);
    } catch (err) {
      setError('Pa ka pran snapshot');
    }
  };

  // Start stream
  const startStream = async (deviceId, parentId, xCloudId) => {
    try {
      return await api.startStream(deviceId, parentId, xCloudId);
    } catch (err) {
      setError('Pa ka kòmanse stream');
    }
  };

  // Get library
  const getLibrary = async (from, to) => {
    try {
      return await api.getLibrary(from, to);
    } catch (err) {
      setError('Pa ka jwenn bibliyotèk la');
    }
  };

  // Auto-load devices on login
  useEffect(() => {
    if (token) {
      loadDevices();
    }
  }, [token, loadDevices]);

  const value = {
    token, userId, isLoggedIn,
    devices, cameras, baseStations, currentMode,
    loading, error,
    login, getFactors, startAuth, finishAuth, logout,
    loadDevices, changeMode,
    takeSnapshot, startStream, getLibrary,
    setError
  };

  return (
    <ArloContext.Provider value={value}>
      {children}
    </ArloContext.Provider>
  );
}

export function useArlo() {
  const context = useContext(ArloContext);
  if (!context) throw new Error('useArlo must be used inside ArloProvider');
  return context;
}
