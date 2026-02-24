// Arlo API Service — Frontend API calls
import axios from 'axios';

const API_BASE = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Add token to all requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('arlo_token');
  if (token) {
    config.headers['X-Arlo-Token'] = token;
  }
  return config;
});

// Handle auth errors (skip for auth endpoints)
api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/login') || url.includes('/get-factors')
      || url.includes('/start-auth') || url.includes('/finish-auth');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('arlo_token');
      localStorage.removeItem('arlo_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth (4-step flow) ───

// Step 1: Login with email/password
export async function login(email, password) {
  const { data } = await api.post('/login', { email, password });
  return data;
}

// Step 2: Get 2FA factors (email, SMS, push)
export async function getFactors(token, userId) {
  const { data } = await api.post('/get-factors', { token, userId });
  return data;
}

// Step 3: Start 2FA (sends code via email/SMS)
export async function startAuth(token, factorId, userId) {
  const { data } = await api.post('/start-auth', { token, factorId, userId });
  return data;
}

// Step 4: Finish 2FA (validate OTP code)
export async function finishAuth(token, factorAuthCode, otp) {
  const { data } = await api.post('/finish-auth', { token, factorAuthCode, otp });
  return data;
}

// ─── Devices ───
export async function getDevices() {
  const { data } = await api.get('/devices');
  return data;
}

// ─── Modes ───
export async function getModes() {
  const { data } = await api.get('/modes');
  return data;
}

export async function setMode(deviceId, xCloudId, mode) {
  const userId = localStorage.getItem('arlo_user');
  const { data } = await api.post('/mode', { deviceId, xCloudId, mode, userId });
  return data;
}

// ─── Camera ───
export async function takeSnapshot(deviceId, parentId, xCloudId) {
  const userId = localStorage.getItem('arlo_user');
  const { data } = await api.post('/snapshot', { deviceId, parentId, xCloudId, userId });
  return data;
}

export async function startStream(deviceId, parentId, xCloudId) {
  const userId = localStorage.getItem('arlo_user');
  const { data } = await api.post('/stream', { deviceId, parentId, xCloudId, userId });
  return data;
}

// ─── Library ───
export async function getLibrary(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await api.get('/library', { params });
  return data;
}

// ─── Health ───
export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
