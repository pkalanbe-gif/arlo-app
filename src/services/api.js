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

// Handle auth errors
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('arlo_token');
      localStorage.removeItem('arlo_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ───
export async function login(email, password) {
  const { data } = await api.post('/login', { email, password });
  return data;
}

export async function verify2FA(token, otp, factorId) {
  const { data } = await api.post('/verify-2fa', { token, otp, factorId });
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
  const { data } = await api.post('/mode', { deviceId, xCloudId, mode });
  return data;
}

// ─── Camera ───
export async function takeSnapshot(deviceId, parentId, xCloudId) {
  const { data } = await api.post('/snapshot', { deviceId, parentId, xCloudId });
  return data;
}

export async function startStream(deviceId, parentId, xCloudId) {
  const { data } = await api.post('/stream', { deviceId, parentId, xCloudId });
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
