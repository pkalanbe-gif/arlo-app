// Arlo Camera API Proxy — Backend for Arlo PWA
// Handles authentication and proxies requests to Arlo Cloud API

const ARLO_BASE = 'https://myapi.arlo.com/hmsweb';
const ARLO_AUTH_URL = 'https://ocapi-app.arlo.com/api/auth';

// In-memory session cache (per function instance)
let sessions = {};

// ─── Helper: Make request to Arlo API ───
async function arloFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
      'Origin': 'https://my.arlo.com',
      'Referer': 'https://my.arlo.com/',
      ...(options.headers || {})
    }
  });
  return res;
}

// ─── Helper: Get auth headers ───
function getAuthHeaders(token) {
  return {
    'Authorization': token,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
    'Origin': 'https://my.arlo.com',
    'Referer': 'https://my.arlo.com/',
    'schemaVersion': '1'
  };
}

// ─── CORS Headers ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arlo-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// ─── Response helpers ───
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: corsHeaders });
}

// ─── Route: Login to Arlo ───
async function handleLogin(body) {
  const { email, password } = body;
  if (!email || !password) {
    return errorResponse('Email ak password obligatwa', 400);
  }

  try {
    // Step 1: Initial auth request
    const authRes = await arloFetch(ARLO_AUTH_URL, {
      method: 'POST',
      body: JSON.stringify({ email, password, language: 'fr', EnvSource: 'prod' })
    });

    const authData = await authRes.json();

    if (!authRes.ok || !authData.data) {
      // Return 200 with success:false so frontend 401-interceptor doesn't interfere
      return jsonResponse({
        success: false,
        error: authData.message || 'Login echwe. Verifye email/password ou.'
      });
    }

    // Check if 2FA is required
    if (authData.data.authenticated === 0) {
      // 2FA needed - return factor info
      return jsonResponse({
        success: true,
        step: '2fa',
        token: authData.data.token,
        factorId: authData.data.factorId || null,
        message: 'Verifikasyon 2FA obligatwa. Tcheke imel/SMS ou.'
      });
    }

    // Authenticated successfully
    const token = authData.data.token;
    const userId = authData.data.userId;

    // Cache session
    sessions[userId] = { token, email, loginTime: Date.now() };

    return jsonResponse({
      success: true,
      step: 'done',
      token,
      userId,
      email
    });
  } catch (err) {
    return errorResponse('Erè koneksyon ak Arlo: ' + err.message, 500);
  }
}

// ─── Route: Verify 2FA ───
async function handleVerify2FA(body) {
  const { token, otp, factorId } = body;
  if (!token || !otp) {
    return errorResponse('Token ak OTP obligatwa', 400);
  }

  try {
    const verifyUrl = `${ARLO_AUTH_URL}/verify`;
    const res = await arloFetch(verifyUrl, {
      method: 'POST',
      headers: { 'Authorization': token },
      body: JSON.stringify({ factorId, otp })
    });

    const data = await res.json();

    if (!res.ok || !data.data) {
      return jsonResponse({ success: false, error: 'Kòd 2FA pa bon' });
    }

    const newToken = data.data.token || token;
    const userId = data.data.userId;

    sessions[userId] = { token: newToken, loginTime: Date.now() };

    return jsonResponse({
      success: true,
      step: 'done',
      token: newToken,
      userId
    });
  } catch (err) {
    return errorResponse('Erè verifikasyon 2FA: ' + err.message, 500);
  }
}

// ─── Route: Get Devices ───
async function handleGetDevices(token) {
  try {
    const res = await arloFetch(`${ARLO_BASE}/v2/users/devices`, {
      method: 'GET',
      headers: getAuthHeaders(token)
    });

    const data = await res.json();

    if (!data.data) {
      return errorResponse('Pa ka jwenn aparèy yo', 500);
    }

    // Organize devices
    const devices = data.data.map(d => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      modelId: d.modelId,
      parentId: d.parentId,
      uniqueId: d.uniqueId,
      state: d.state,
      properties: d.properties || {},
      mediaObjectCount: d.mediaObjectCount,
      xCloudId: d.xCloudId,
      firmwareVersion: d.firmwareVersion,
      interfaceVersion: d.interfaceVersion
    }));

    const baseStations = devices.filter(d =>
      d.deviceType === 'basestation' || d.deviceType === 'siren'
    );
    const cameras = devices.filter(d => d.deviceType === 'camera');

    return jsonResponse({
      success: true,
      devices,
      baseStations,
      cameras
    });
  } catch (err) {
    return errorResponse('Erè jwenn aparèy: ' + err.message, 500);
  }
}

// ─── Route: Get Modes ───
async function handleGetModes(token) {
  try {
    const res = await arloFetch(`${ARLO_BASE}/users/automation/definitions?uniqueIds=all`, {
      method: 'GET',
      headers: getAuthHeaders(token)
    });

    const data = await res.json();
    return jsonResponse({ success: true, modes: data.data || [] });
  } catch (err) {
    return errorResponse('Erè jwenn mòd: ' + err.message, 500);
  }
}

// ─── Route: Set Mode (Arm/Disarm) ───
async function handleSetMode(token, body) {
  const { deviceId, xCloudId, mode } = body;

  try {
    const transId = `node!${Date.now()}`;
    const res = await arloFetch(`${ARLO_BASE}/users/devices/automation/active`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'xcloudId': xCloudId
      },
      body: JSON.stringify({
        from: `${deviceId}_web`,
        to: deviceId,
        action: 'set',
        resource: 'modes',
        transId,
        publishResponse: true,
        properties: { active: mode }
      })
    });

    const data = await res.json();
    return jsonResponse({ success: data.success !== false, data: data.data });
  } catch (err) {
    return errorResponse('Erè chanje mòd: ' + err.message, 500);
  }
}

// ─── Route: Take Snapshot ───
async function handleSnapshot(token, body) {
  const { deviceId, parentId, xCloudId } = body;

  try {
    const transId = `node!${Date.now()}`;
    const res = await arloFetch(`${ARLO_BASE}/users/devices/fullFrameSnapshot`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'xcloudId': xCloudId
      },
      body: JSON.stringify({
        from: `${parentId}_web`,
        to: parentId,
        action: 'set',
        resource: `cameras/${deviceId}`,
        transId,
        publishResponse: true,
        properties: { activityState: 'fullFrameSnapshot' }
      })
    });

    const data = await res.json();
    return jsonResponse({ success: true, data: data.data });
  } catch (err) {
    return errorResponse('Erè snapshot: ' + err.message, 500);
  }
}

// ─── Route: Start Stream ───
async function handleStream(token, body) {
  const { deviceId, parentId, xCloudId } = body;

  try {
    const transId = `node!${Date.now()}`;
    const res = await arloFetch(`${ARLO_BASE}/users/devices/startStream`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(token),
        'xcloudId': xCloudId
      },
      body: JSON.stringify({
        from: `${parentId}_web`,
        to: parentId,
        action: 'set',
        resource: `cameras/${deviceId}`,
        transId,
        publishResponse: true,
        properties: {
          activityState: 'startUserStream',
          cameraId: deviceId
        }
      })
    });

    const data = await res.json();
    return jsonResponse({
      success: true,
      url: data.data?.url || null,
      data: data.data
    });
  } catch (err) {
    return errorResponse('Erè start stream: ' + err.message, 500);
  }
}

// ─── Route: Get Library (Recordings) ───
async function handleLibrary(token, query) {
  try {
    const now = new Date();
    const from = query.from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = query.to || now.toISOString().split('T')[0];

    const [yearFrom, monthFrom, dayFrom] = from.split('-');
    const [yearTo, monthTo, dayTo] = to.split('-');

    const res = await arloFetch(`${ARLO_BASE}/users/library`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        dateFrom: `${yearFrom}${monthFrom}${dayFrom}`,
        dateTo: `${yearTo}${monthTo}${dayTo}`
      })
    });

    const data = await res.json();
    return jsonResponse({
      success: true,
      recordings: data.data || []
    });
  } catch (err) {
    return errorResponse('Erè jwenn bibliyotèk: ' + err.message, 500);
  }
}

// ─── Route: Health check ───
function handleHealth() {
  return jsonResponse({
    status: 'ok',
    message: 'Arlo Camera PWA API',
    timestamp: new Date().toISOString()
  });
}

// ─── Main Handler ───
export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname;

  // Robust path parsing — works with both redirect and direct routing
  const path = rawPath
    .replace(/^\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/$/, '')
    || '/';

  const method = req.method;

  // Debug: log routing info
  console.log(`[Arlo API] ${method} ${rawPath} → path: "${path}"`);

  // Extract token from header
  const token = req.headers.get('x-arlo-token') || req.headers.get('authorization');

  // Parse body for POST requests
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }
  }

  // Parse query params
  const query = Object.fromEntries(url.searchParams);

  // ─── Routing ───
  try {
    // Health check
    if (path === '/' || path === '/health') {
      return handleHealth();
    }

    // Auth routes (no token needed)
    if (path === '/login' && method === 'POST') {
      console.log('[Arlo API] Login attempt for:', body.email);
      return handleLogin(body);
    }
    if (path === '/verify-2fa' && method === 'POST') {
      return handleVerify2FA(body);
    }

    // All other routes need token
    if (!token) {
      return errorResponse('Token obligatwa. Konekte avan.', 401);
    }

    // Device routes
    if (path === '/devices' && method === 'GET') {
      return handleGetDevices(token);
    }

    // Mode routes
    if (path === '/modes' && method === 'GET') {
      return handleGetModes(token);
    }
    if (path === '/mode' && method === 'POST') {
      return handleSetMode(token, body);
    }

    // Camera routes
    if (path === '/snapshot' && method === 'POST') {
      return handleSnapshot(token, body);
    }
    if (path === '/stream' && method === 'POST') {
      return handleStream(token, body);
    }

    // Library
    if (path === '/library' && method === 'GET') {
      return handleLibrary(token, query);
    }

    // 404
    return errorResponse('Route pa egziste: ' + path, 404);

  } catch (err) {
    console.error('[Arlo API] Error:', err.message);
    return errorResponse('Erè entèn: ' + err.message, 500);
  }
}
