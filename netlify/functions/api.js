// Arlo Camera API Proxy — Backend for Arlo PWA
// Handles authentication and proxies requests to Arlo Cloud API
// Auth flow based on pyaarlo: https://github.com/twrecked/pyaarlo

import { randomUUID } from 'crypto';

const ARLO_BASE = 'https://myapi.arlo.com/hmsweb';
const ARLO_AUTH_HOST = 'https://ocapi-app.arlo.com';

// Default device ID (overridden by client-sent device ID for consistency)
const DEFAULT_DEVICE_ID = randomUUID();

// In-memory session cache (per function instance)
let sessions = {};

// ─── Helper: Auth headers for Arlo API ───
// deviceId parameter allows frontend to send a consistent device ID
function arloAuthHeaders(extraHeaders = {}, deviceId = null) {
  return {
    'Content-Type': 'application/json',
    'User-Agent': '(iPhone15,2 18_1_1) iOS Arlo 5.4.3',
    'Origin': 'https://my.arlo.com',
    'Referer': 'https://my.arlo.com/',
    'Source': 'arloCamWeb',
    'X-User-Device-Id': deviceId || DEFAULT_DEVICE_ID,
    'X-User-Device-Type': 'BROWSER',
    ...extraHeaders
  };
}

// ─── Helper: Make request to Arlo API ───
async function arloFetch(url, options = {}, deviceId = null) {
  const res = await fetch(url, {
    ...options,
    headers: arloAuthHeaders(options.headers || {}, deviceId)
  });
  return res;
}

// ─── Helper: Get auth headers with token (for ocapi-app.arlo.com — token is base64) ───
function getAuthHeadersBase64(token, deviceId = null) {
  const token64 = Buffer.from(token).toString('base64');
  return {
    ...arloAuthHeaders({}, deviceId),
    'Authorization': token64
  };
}

// ─── Helper: Get headers for regular API (myapi.arlo.com — token is plain) ───
function getAuthHeaders(token, deviceId = null) {
  return {
    ...arloAuthHeaders({}, deviceId),
    'Authorization': token,
    'Auth-Version': '2',
    'schemaVersion': '1'
  };
}

// ─── Helper: Validate token + create session ───
async function validateAndCreateSession(token, deviceId = null) {
  console.log(`[Arlo API] Validating access token with deviceId: ${deviceId || 'default'}...`);
  // Step 1: Validate the access token
  const validateRes = await arloFetch(`${ARLO_AUTH_HOST}/api/validateAccessToken?data=${Date.now()}`, {
    method: 'GET',
    headers: { 'Authorization': Buffer.from(token).toString('base64') }
  }, deviceId);
  const validateText = await validateRes.text();
  console.log(`[Arlo API] validateToken status: ${validateRes.status}`);
  console.log(`[Arlo API] validateToken body: ${validateText.substring(0, 300)}`);

  if (validateRes.status !== 200) {
    console.error('[Arlo API] Token validation failed');
    return { success: false, error: 'Token validation failed' };
  }

  // Step 2: Create session v3 — try v3 first (pyaarlo uses v3)
  console.log('[Arlo API] Creating session v3...');
  let sessionData = null;
  try {
    const sessionRes = await arloFetch(`${ARLO_BASE}/users/session/v3`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);
    const sessionText = await sessionRes.text();
    console.log(`[Arlo API] Session v3 status: ${sessionRes.status}`);
    console.log(`[Arlo API] Session v3 body: ${sessionText.substring(0, 500)}`);

    if (sessionRes.status === 200) {
      try { sessionData = JSON.parse(sessionText); } catch (e) {}
    } else {
      console.warn('[Arlo API] Session v3 failed, trying v2...');
      const sessionRes2 = await arloFetch(`${ARLO_BASE}/users/session/v2`, {
        method: 'GET',
        headers: getAuthHeaders(token, deviceId)
      }, deviceId);
      const sessionText2 = await sessionRes2.text();
      console.log(`[Arlo API] Session v2 status: ${sessionRes2.status}`);
      console.log(`[Arlo API] Session v2 body: ${sessionText2.substring(0, 500)}`);
      if (sessionRes2.status === 200) {
        try { sessionData = JSON.parse(sessionText2); } catch (e) {}
      }
    }
  } catch (sessionErr) {
    console.warn('[Arlo API] Session creation error (non-fatal):', sessionErr.message);
  }

  return { success: true, sessionData };
}

// ─── CORS Headers ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arlo-Token, X-Arlo-Device-Id',
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

// ─── Route: Login to Arlo (Step 1) ───
async function handleLogin(body, deviceId = null) {
  const { email, password } = body;
  if (!email || !password) {
    return errorResponse('Email ak password obligatwa', 400);
  }

  try {
    // CRITICAL: Arlo requires Base64 encoded password
    const encodedPassword = Buffer.from(password).toString('base64');

    console.log(`[Arlo API] Login attempt for: ${email}`);
    console.log(`[Arlo API] Using Device-Id: ${deviceId || DEFAULT_DEVICE_ID}`);

    const authRes = await arloFetch(`${ARLO_AUTH_HOST}/api/auth`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: encodedPassword,
        language: 'en',
        EnvSource: 'prod'
      })
    }, deviceId);

    const authText = await authRes.text();
    console.log(`[Arlo API] Auth status: ${authRes.status}`);
    console.log(`[Arlo API] Auth body: ${authText.substring(0, 500)}`);

    let authData;
    try {
      authData = JSON.parse(authText);
    } catch (e) {
      return jsonResponse({
        success: false,
        error: `Arlo retounen yon repons ki pa JSON (status ${authRes.status})`
      });
    }

    if (!authData.data) {
      const arloMsg = authData.message || authData.meta?.message || '';
      const errorMap = {
        'Password not correct': 'Password pa kòrèk. Tcheke password ou.',
        'User not found': 'Kont sa pa egziste. Tcheke email ou.',
        'Too many attempts': 'Twòp esè. Tann kèk minit epi eseye ankò.',
        'Account locked': 'Kont ou bloke. Ale sou my.arlo.com pou debloke li.'
      };
      const friendlyMsg = errorMap[arloMsg] || arloMsg || `Login echwe (${authRes.status}). Verifye email/password ou.`;
      return jsonResponse({ success: false, error: friendlyMsg });
    }

    const token = authData.data.token;
    const userId = authData.data.userId;
    const authenticated = authData.data.authenticated;
    const authCompleted = authData.data.authCompleted;

    console.log(`[Arlo API] authenticated=${authenticated}, authCompleted=${authCompleted}`);

    // Check if auth is fully completed (trusted device, no 2FA needed)
    if (authCompleted === true) {
      // Validate token and create session
      console.log(`[Arlo API] Auth completed, validating token...`);
      const validation = await validateAndCreateSession(token, deviceId);
      if (!validation.success) {
        return jsonResponse({
          success: false,
          error: 'Token validation echwe. Eseye ankò.'
        });
      }

      sessions[userId] = { token, email, loginTime: Date.now() };
      return jsonResponse({
        success: true,
        step: 'done',
        token,
        userId,
        email
      });
    }

    // 2FA required — fetch factors immediately so frontend gets them in one call
    console.log(`[Arlo API] 2FA required, fetching factors inline...`);
    const token64 = Buffer.from(token).toString('base64');
    try {
      const factorsRes = await arloFetch(`${ARLO_AUTH_HOST}/api/getFactors?data=${Date.now()}`, {
        method: 'GET',
        headers: { 'Authorization': token64 }
      }, deviceId);
      const factorsData = await factorsRes.json();
      console.log(`[Arlo API] Inline getFactors status: ${factorsRes.status}`);
      console.log(`[Arlo API] Inline getFactors body: ${JSON.stringify(factorsData).substring(0, 500)}`);

      if (factorsData.data && factorsData.data.items) {
        const factors = factorsData.data.items.map(f => ({
          factorId: f.factorId,
          factorType: f.factorType,
          displayName: f.displayName || f.factorType,
          factorRole: f.factorRole
        }));
        return jsonResponse({
          success: true,
          step: '2fa-factors',
          token,
          userId,
          factors,
          message: 'Bezwen verifikasyon 2FA. Chwazi kòman resevwa kòd la.'
        });
      }
    } catch (factorErr) {
      console.error('[Arlo API] Inline getFactors error:', factorErr.message);
    }

    // Fallback: return without factors, frontend will call get-factors separately
    return jsonResponse({
      success: true,
      step: '2fa-factors',
      token,
      userId,
      message: 'Bezwen verifikasyon 2FA. Chwazi kòman resevwa kòd la.'
    });
  } catch (err) {
    console.error('[Arlo API] Login error:', err.message);
    return errorResponse('Erè koneksyon ak Arlo: ' + err.message, 500);
  }
}

// ─── Route: Get 2FA Factors (Step 2) ───
async function handleGetFactors(body, deviceId = null) {
  const { token, userId } = body;
  if (!token || !userId) {
    return errorResponse('Token ak userId obligatwa', 400);
  }

  try {
    const token64 = Buffer.from(token).toString('base64');
    const res = await arloFetch(`${ARLO_AUTH_HOST}/api/getFactors?data=${Date.now()}`, {
      method: 'GET',
      headers: { 'Authorization': token64 }
    }, deviceId);

    const data = await res.json();
    console.log(`[Arlo API] getFactors status: ${res.status}`);
    console.log(`[Arlo API] getFactors body: ${JSON.stringify(data).substring(0, 500)}`);

    if (!data.data || !data.data.items) {
      return jsonResponse({
        success: false,
        error: 'Pa ka jwenn opsyon verifikasyon yo'
      });
    }

    // Return available factors (email, SMS, push)
    const factors = data.data.items.map(f => ({
      factorId: f.factorId,
      factorType: f.factorType,
      displayName: f.displayName || f.factorType,
      factorRole: f.factorRole
    }));

    return jsonResponse({
      success: true,
      factors
    });
  } catch (err) {
    console.error('[Arlo API] getFactors error:', err.message);
    return errorResponse('Erè jwenn opsyon 2FA: ' + err.message, 500);
  }
}

// ─── Route: Start 2FA Auth (Step 3 — sends code to email/SMS) ───
async function handleStartAuth(body, deviceId = null) {
  const { token, factorId, userId } = body;
  if (!token || !factorId) {
    return errorResponse('Token ak factorId obligatwa', 400);
  }

  try {
    const token64 = Buffer.from(token).toString('base64');
    const res = await arloFetch(`${ARLO_AUTH_HOST}/api/startAuth`, {
      method: 'POST',
      headers: { 'Authorization': token64 },
      body: JSON.stringify({ factorId })
    }, deviceId);

    const data = await res.json();
    console.log(`[Arlo API] startAuth status: ${res.status}`);
    console.log(`[Arlo API] startAuth body: ${JSON.stringify(data).substring(0, 500)}`);

    if (!data.data || !data.data.factorAuthCode) {
      return jsonResponse({
        success: false,
        error: data.message || 'Pa ka kòmanse verifikasyon'
      });
    }

    return jsonResponse({
      success: true,
      factorAuthCode: data.data.factorAuthCode,
      message: 'Kòd verifikasyon voye! Tcheke email/SMS ou.'
    });
  } catch (err) {
    console.error('[Arlo API] startAuth error:', err.message);
    return errorResponse('Erè kòmanse 2FA: ' + err.message, 500);
  }
}

// ─── Route: Finish 2FA Auth (Step 4 — validate OTP code) ───
async function handleFinishAuth(body, deviceId = null) {
  const { token, factorAuthCode, otp } = body;
  if (!token || !factorAuthCode || !otp) {
    return errorResponse('Token, factorAuthCode ak OTP obligatwa', 400);
  }

  try {
    const token64 = Buffer.from(token).toString('base64');
    const res = await arloFetch(`${ARLO_AUTH_HOST}/api/finishAuth`, {
      method: 'POST',
      headers: { 'Authorization': token64 },
      body: JSON.stringify({
        factorAuthCode,
        otp,
        isBrowserTrusted: true
      })
    }, deviceId);

    const data = await res.json();
    console.log(`[Arlo API] finishAuth status: ${res.status}`);
    console.log(`[Arlo API] finishAuth body: ${JSON.stringify(data).substring(0, 500)}`);

    if (!data.data || !data.data.token) {
      return jsonResponse({
        success: false,
        error: data.message || 'Kòd verifikasyon pa bon. Eseye ankò.'
      });
    }

    const finalToken = data.data.token;
    const userId = data.data.userId;

    // Validate token and create session
    console.log(`[Arlo API] 2FA done, validating token and creating session...`);
    const validation = await validateAndCreateSession(finalToken, deviceId);
    if (!validation.success) {
      return jsonResponse({
        success: false,
        error: 'Token validation echwe apre 2FA. Eseye ankò.'
      });
    }

    sessions[userId] = { token: finalToken, loginTime: Date.now() };

    return jsonResponse({
      success: true,
      step: 'done',
      token: finalToken,
      userId,
      authenticated: true
    });
  } catch (err) {
    console.error('[Arlo API] finishAuth error:', err.message);
    return errorResponse('Erè verifikasyon 2FA: ' + err.message, 500);
  }
}

// ─── Device type classification ───
const BASE_STATION_TYPES = new Set([
  'basestation', 'siren', 'hub', 'bridge'
]);

function isBaseStation(deviceType) {
  if (!deviceType) return false;
  const dt = deviceType.toLowerCase();
  return BASE_STATION_TYPES.has(dt) || dt.includes('basestation') || dt.includes('hub');
}

function isCamera(device) {
  if (!device.deviceType) return false;
  const dt = device.deviceType.toLowerCase();
  // Explicitly NOT a base station, siren, routerM1, etc.
  if (isBaseStation(dt)) return false;
  if (dt === 'siren' || dt === 'routerm1') return false;
  // It's a camera if deviceType is 'camera', arloq, arloqs, doorbell, light,
  // or anything else that has a parentId (child device = camera-like)
  if (dt === 'camera' || dt.startsWith('arlo') || dt === 'doorbell' || dt === 'light' || dt === 'lights') {
    return true;
  }
  // If it has a parentId, it's likely a child device (camera attached to base station)
  if (device.parentId && device.parentId !== device.deviceId) {
    return true;
  }
  return false;
}

// ─── Route: Get Devices ───
async function handleGetDevices(token, deviceId = null) {
  try {
    console.log(`[Arlo API] Getting devices with token: ${token.substring(0, 30)}...`);
    const res = await arloFetch(`${ARLO_BASE}/v2/users/devices?t=${Date.now()}`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);

    const dataText = await res.text();
    console.log(`[Arlo API] Devices status: ${res.status}`);
    // Log more of the response to see all devices
    console.log(`[Arlo API] Devices body length: ${dataText.length}`);
    console.log(`[Arlo API] Devices body: ${dataText.substring(0, 2000)}`);

    let data;
    try { data = JSON.parse(dataText); } catch (e) {
      return errorResponse('Arlo retounen repons ki pa JSON pou devices', 500);
    }

    if (!data.data || data.success === false) {
      const errMsg = data.data?.message || data.data?.reason || data.message || data.meta?.message || 'Pa ka jwenn aparèy yo';
      console.error(`[Arlo API] Devices error: ${errMsg}`);
      // If invalid token, tell frontend to re-login
      if (data.data?.error === '2015' || data.data?.reason === 'Invalid Token') {
        return errorResponse('Sesyon ekspire. Tanpri konekte ankò.', 401);
      }
      return errorResponse(errMsg, 500);
    }

    // Make sure data.data is an array
    if (!Array.isArray(data.data)) {
      console.error(`[Arlo API] Devices data is not array: ${typeof data.data}`);
      return errorResponse('Repons aparèy pa bon. Eseye ankò.', 500);
    }

    // Log each device type for debugging
    data.data.forEach((d, i) => {
      console.log(`[Arlo API] Device ${i}: id=${d.deviceId}, name=${d.deviceName}, type=${d.deviceType}, model=${d.modelId}, parent=${d.parentId}, state=${JSON.stringify(d.state?.connectionState)}`);
    });
    console.log(`[Arlo API] Total devices from Arlo: ${data.data.length}`);

    const devices = data.data.map(d => {
      // Normalize state: can be a string like "provisioned" or an object like {connectionState: "available"}
      let normalizedState;
      if (typeof d.state === 'string') {
        // Map Arlo state strings to our connectionState format
        const stateStr = d.state.toLowerCase();
        const isOnline = stateStr === 'provisioned' || stateStr === 'online' || stateStr === 'available';
        normalizedState = { connectionState: isOnline ? 'available' : 'offline', rawState: d.state };
      } else if (d.state && typeof d.state === 'object') {
        normalizedState = d.state;
      } else {
        normalizedState = { connectionState: 'unknown', rawState: String(d.state) };
      }

      return {
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        modelId: d.modelId,
        parentId: d.parentId,
        uniqueId: d.uniqueId,
        state: normalizedState,
        properties: d.properties || {},
        mediaObjectCount: d.mediaObjectCount,
        xCloudId: d.xCloudId,
        firmwareVersion: d.firmwareVersion,
        interfaceVersion: d.interfaceVersion,
        owner: d.owner
      };
    });

    const baseStations = devices.filter(d => isBaseStation(d.deviceType));
    const cameras = devices.filter(d => isCamera(d));

    console.log(`[Arlo API] Classified: ${baseStations.length} base stations, ${cameras.length} cameras, ${devices.length - baseStations.length - cameras.length} other`);

    return jsonResponse({ success: true, devices, baseStations, cameras });
  } catch (err) {
    return errorResponse('Erè jwenn aparèy: ' + err.message, 500);
  }
}

// ─── Route: Get Raw Devices (debug) ───
async function handleGetDevicesRaw(token, deviceId = null) {
  try {
    const res = await arloFetch(`${ARLO_BASE}/v2/users/devices?t=${Date.now()}`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);
    const data = await res.json();
    // Return raw Arlo response for debugging
    return jsonResponse({
      success: true,
      totalDevices: Array.isArray(data.data) ? data.data.length : 0,
      rawDevices: Array.isArray(data.data) ? data.data.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        modelId: d.modelId,
        parentId: d.parentId,
        state: d.state,
        xCloudId: d.xCloudId,
        uniqueId: d.uniqueId,
        owner: d.owner,
        properties: d.properties
      })) : data.data,
      arloSuccess: data.success
    });
  } catch (err) {
    return errorResponse('Debug devices error: ' + err.message, 500);
  }
}

// ─── Route: Get Modes ───
async function handleGetModes(token, deviceId = null) {
  try {
    const res = await arloFetch(`${ARLO_BASE}/users/automation/definitions?uniqueIds=all`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);
    const data = await res.json();
    return jsonResponse({ success: true, modes: data.data || [] });
  } catch (err) {
    return errorResponse('Erè jwenn mòd: ' + err.message, 500);
  }
}

// ─── Route: Set Mode (Arm/Disarm) ───
async function handleSetMode(token, body, clientDId = null) {
  const { deviceId, xCloudId, mode, userId } = body;
  try {
    const webId = userId ? `${userId}_web` : `${deviceId}_web`;
    const transId = `node!${Date.now()}`;
    const res = await arloFetch(`${ARLO_BASE}/users/devices/automation/active`, {
      method: 'POST',
      headers: { ...getAuthHeaders(token, clientDId), 'xcloudId': xCloudId },
      body: JSON.stringify({
        from: webId, to: deviceId,
        action: 'set', resource: 'modes', transId,
        publishResponse: true, responseUrl: '', properties: { active: mode }
      })
    }, clientDId);
    const data = await res.json();
    return jsonResponse({ success: data.success !== false, data: data.data });
  } catch (err) {
    return errorResponse('Erè chanje mòd: ' + err.message, 500);
  }
}

// ─── Route: Take Snapshot ───
async function handleSnapshot(token, body, clientDId = null) {
  const { deviceId, parentId, xCloudId, userId } = body;
  const webId = userId ? `${userId}_web` : `${parentId}_web`;
  console.log(`[Arlo API] Snapshot request: camera=${deviceId}, parent=${parentId}, xCloudId=${xCloudId}, from=${webId}`);

  if (!deviceId || !parentId || !xCloudId) {
    return errorResponse('deviceId, parentId, ak xCloudId obligatwa pou snapshot', 400);
  }

  try {
    const transId = `node!${Date.now()}`;

    // Step 1: Request snapshot from base station
    const res = await arloFetch(`${ARLO_BASE}/users/devices/fullFrameSnapshot`, {
      method: 'POST',
      headers: { ...getAuthHeaders(token, clientDId), 'xcloudId': xCloudId },
      body: JSON.stringify({
        from: webId, to: parentId,
        action: 'set', resource: `cameras/${deviceId}`, transId,
        publishResponse: true, responseUrl: '',
        properties: { activityState: 'fullFrameSnapshot' }
      })
    }, clientDId);

    const dataText = await res.text();
    console.log(`[Arlo API] Snapshot status: ${res.status}`);
    console.log(`[Arlo API] Snapshot body: ${dataText.substring(0, 1000)}`);

    let data;
    try { data = JSON.parse(dataText); } catch (e) {
      return errorResponse('Arlo retounen repons ki pa JSON pou snapshot', 500);
    }

    // The snapshot command is async - Arlo may not return the URL immediately.
    // Try to get lastImageUrl from the device after a short delay.
    if (!data.data?.url && !data.data?.presignedFullFrameSnapshotUrl) {
      console.log('[Arlo API] No immediate snapshot URL, trying to get last image...');

      // Wait a moment for the snapshot to be taken
      await new Promise(r => setTimeout(r, 3000));

      // Fetch the device to get the latest image URL
      const devRes = await arloFetch(`${ARLO_BASE}/users/devices?t=${Date.now()}`, {
        method: 'GET',
        headers: getAuthHeaders(token, clientDId)
      }, clientDId);
      const devData = await devRes.json();

      if (Array.isArray(devData.data)) {
        const cam = devData.data.find(d => d.deviceId === deviceId);
        const lastUrl = cam?.presignedLastImageUrl || cam?.lastImageUrl || cam?.properties?.lastImageUrl;
        console.log(`[Arlo API] Device lastImageUrl: ${lastUrl ? lastUrl.substring(0, 100) + '...' : 'null'}`);

        if (lastUrl) {
          return jsonResponse({ success: true, data: { url: lastUrl } });
        }
      }
    }

    const snapshotUrl = data.data?.presignedFullFrameSnapshotUrl || data.data?.url || null;
    console.log(`[Arlo API] Snapshot URL: ${snapshotUrl ? snapshotUrl.substring(0, 100) + '...' : 'null'}`);

    return jsonResponse({
      success: true,
      data: { ...data.data, url: snapshotUrl }
    });
  } catch (err) {
    console.error('[Arlo API] Snapshot error:', err.message);
    return errorResponse('Erè snapshot: ' + err.message, 500);
  }
}

// ─── Route: Start Stream ───
// Strategy: Open SSE subscribe, send notify to start stream, read stream URL from SSE events
async function handleStream(token, body, clientDId = null) {
  const { deviceId, parentId, xCloudId, userId } = body;
  const webId = userId ? `${userId}_web` : `${parentId}_web`;
  console.log(`[Arlo API] Stream request: camera=${deviceId}, parent=${parentId}, xCloudId=${xCloudId}, from=${webId}, deviceId=${clientDId || 'default'}`);

  if (!deviceId || !parentId || !xCloudId) {
    return errorResponse('deviceId, parentId, ak xCloudId obligatwa pou stream', 400);
  }

  try {
    // Step 1: Open SSE subscribe connection to receive events
    console.log('[Arlo API] Opening SSE subscribe connection...');
    const sseController = new AbortController();
    let streamUrl = null;
    let sseEvents = [];

    const ssePromise = (async () => {
      try {
        const sseRes = await fetch(`${ARLO_BASE}/client/subscribe?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            ...getAuthHeaders(token, clientDId),
            'Accept': 'text/event-stream'
          },
          signal: sseController.signal
        });

        console.log(`[Arlo API] SSE status: ${sseRes.status}`);

        if (!sseRes.ok || !sseRes.body) {
          console.warn(`[Arlo API] SSE connection failed: ${sseRes.status}`);
          return;
        }

        // Read the SSE stream for events
        const reader = sseRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          console.log(`[Arlo API] SSE chunk: ${buffer.substring(0, 500)}`);

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const eventData = line.substring(6).trim();
              if (eventData) {
                try {
                  const parsed = JSON.parse(eventData);
                  sseEvents.push(parsed);
                  console.log(`[Arlo API] SSE event: ${JSON.stringify(parsed).substring(0, 300)}`);

                  // Look for stream URL in the event
                  if (parsed.properties?.url || parsed.url) {
                    streamUrl = parsed.properties?.url || parsed.url;
                    console.log(`[Arlo API] SSE stream URL found: ${streamUrl}`);
                    sseController.abort();
                    return;
                  }
                } catch (e) {
                  // Not JSON, skip
                }
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Arlo API] SSE error:', err.message);
        }
      }
    })();

    // Wait for SSE to connect
    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Send notify to start the stream (notify works, startStream returns 500)
    console.log('[Arlo API] Sending notify to start stream...');
    const transId = `node!${Date.now()}`;
    const notifyRes = await arloFetch(`${ARLO_BASE}/users/devices/notify/${parentId}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(token, clientDId), 'xcloudId': xCloudId },
      body: JSON.stringify({
        from: webId, to: parentId,
        action: 'set', resource: `cameras/${deviceId}`, transId,
        publishResponse: true, responseUrl: '',
        properties: { activityState: 'startUserStream', cameraId: deviceId }
      })
    }, clientDId);
    const notifyText = await notifyRes.text();
    console.log(`[Arlo API] Notify status: ${notifyRes.status}`);
    console.log(`[Arlo API] Notify body: ${notifyText.substring(0, 500)}`);

    // Step 3: Wait for SSE to deliver the stream URL (up to 8 seconds)
    console.log('[Arlo API] Waiting for stream URL from SSE events...');
    const sseTimeout = setTimeout(() => {
      console.log('[Arlo API] SSE timeout, aborting...');
      sseController.abort();
    }, 8000);

    await Promise.race([
      ssePromise,
      new Promise(r => setTimeout(r, 8500))
    ]);
    clearTimeout(sseTimeout);
    sseController.abort();

    console.log(`[Arlo API] SSE events received: ${sseEvents.length}`);
    console.log(`[Arlo API] Stream URL from SSE: ${streamUrl || 'null'}`);

    // If we got a URL from SSE, return it
    if (streamUrl) {
      let streamType = 'unknown';
      if (streamUrl.startsWith('rtsps://') || streamUrl.startsWith('rtsp://')) streamType = 'rtsp';
      else if (streamUrl.includes('.m3u8')) streamType = 'hls';
      else if (streamUrl.startsWith('https://')) streamType = 'https';

      return jsonResponse({
        success: true,
        url: streamUrl,
        streamType,
        method: 'sse-notify',
        sseEventsCount: sseEvents.length
      });
    }

    // Step 4: If no URL from SSE, also try startStream directly as last resort
    console.log('[Arlo API] No URL from SSE, trying startStream directly...');
    const res = await arloFetch(`${ARLO_BASE}/users/devices/startStream`, {
      method: 'POST',
      headers: { ...getAuthHeaders(token, clientDId), 'xcloudId': xCloudId },
      body: JSON.stringify({
        from: webId, to: parentId,
        action: 'set', resource: `cameras/${deviceId}`,
        transId: `node!${Date.now()}`,
        publishResponse: true, responseUrl: '',
        properties: { activityState: 'startUserStream', cameraId: deviceId }
      })
    }, clientDId);

    const dataText = await res.text();
    console.log(`[Arlo API] startStream status: ${res.status}`);
    console.log(`[Arlo API] startStream body: ${dataText.substring(0, 1000)}`);

    let data;
    try { data = JSON.parse(dataText); } catch (e) {
      return errorResponse('Arlo retounen repons ki pa JSON pou stream', 500);
    }

    const directUrl = data.data?.url || null;
    if (directUrl) {
      let streamType = 'unknown';
      if (directUrl.startsWith('rtsps://') || directUrl.startsWith('rtsp://')) streamType = 'rtsp';
      else if (directUrl.includes('.m3u8')) streamType = 'hls';
      else if (directUrl.startsWith('https://')) streamType = 'https';

      return jsonResponse({ success: true, url: directUrl, streamType, method: 'startStream' });
    }

    // Return error with all debug info
    const errMsg = data.data?.message || data.message || 'Pa ka jwenn URL stream';
    return jsonResponse({
      success: false,
      error: `Stream: ${errMsg}`,
      sseEventsCount: sseEvents.length,
      sseEvents: sseEvents.map(e => JSON.stringify(e).substring(0, 200)),
      notifySuccess: notifyRes.status === 200,
      startStreamStatus: res.status
    }, 500);
  } catch (err) {
    console.error('[Arlo API] Stream error:', err.message);
    return errorResponse('Erè start stream: ' + err.message, 500);
  }
}

// ─── Route: Get Library (Recordings) ───
async function handleLibrary(token, query, deviceId = null) {
  try {
    const now = new Date();
    const from = query.from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = query.to || now.toISOString().split('T')[0];
    const [yearFrom, monthFrom, dayFrom] = from.split('-');
    const [yearTo, monthTo, dayTo] = to.split('-');

    const res = await arloFetch(`${ARLO_BASE}/users/library`, {
      method: 'POST',
      headers: getAuthHeaders(token, deviceId),
      body: JSON.stringify({
        dateFrom: `${yearFrom}${monthFrom}${dayFrom}`,
        dateTo: `${yearTo}${monthTo}${dayTo}`
      })
    }, deviceId);
    const data = await res.json();
    return jsonResponse({ success: true, recordings: data.data || [] });
  } catch (err) {
    return errorResponse('Erè jwenn bibliyotèk: ' + err.message, 500);
  }
}

// ─── Route: Debug session + subscribe ───
async function handleDebugSession(token, deviceId = null) {
  const results = {};

  // Test 1: Session v3 with plain token + consistent deviceId
  try {
    const r1 = await arloFetch(`${ARLO_BASE}/users/session/v3`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);
    const t1 = await r1.text();
    results.sessionV3Plain = { status: r1.status, body: t1.substring(0, 500) };
  } catch (e) { results.sessionV3Plain = { error: e.message }; }

  // Test 2: Session v3 with base64 token
  try {
    const token64 = Buffer.from(token).toString('base64');
    const r2 = await arloFetch(`${ARLO_BASE}/users/session/v3`, {
      method: 'GET',
      headers: { ...arloAuthHeaders({}, deviceId), 'Authorization': token64, 'Auth-Version': '2', 'schemaVersion': '1' }
    }, deviceId);
    const t2 = await r2.text();
    results.sessionV3Base64 = { status: r2.status, body: t2.substring(0, 500) };
  } catch (e) { results.sessionV3Base64 = { error: e.message }; }

  // Test 3: Subscribe with plain token
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r3 = await fetch(`${ARLO_BASE}/client/subscribe?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { ...getAuthHeaders(token, deviceId), 'Accept': 'text/event-stream' },
      signal: ctrl.signal
    });
    results.subscribePlain = { status: r3.status, headers: Object.fromEntries(r3.headers.entries()) };
    if (r3.ok && r3.body) {
      const reader = r3.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      results.subscribePlain.firstChunk = text.substring(0, 300);
      ctrl.abort();
    }
  } catch (e) {
    if (e.name !== 'AbortError') results.subscribePlain = { ...results.subscribePlain, error: e.message };
  }

  // Test 4: Subscribe with base64 token
  try {
    const token64 = Buffer.from(token).toString('base64');
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r4 = await fetch(`${ARLO_BASE}/client/subscribe?token=${encodeURIComponent(token64)}`, {
      method: 'GET',
      headers: { ...arloAuthHeaders({}, deviceId), 'Authorization': token64, 'Accept': 'text/event-stream' },
      signal: ctrl.signal
    });
    results.subscribeBase64 = { status: r4.status };
    if (r4.ok && r4.body) {
      const reader = r4.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      results.subscribeBase64.firstChunk = text.substring(0, 300);
      ctrl.abort();
    }
  } catch (e) {
    if (e.name !== 'AbortError') results.subscribeBase64 = { ...results.subscribeBase64, error: e.message };
  }

  // Test 5: Session v2
  try {
    const r5 = await arloFetch(`${ARLO_BASE}/users/session/v2`, {
      method: 'GET',
      headers: getAuthHeaders(token, deviceId)
    }, deviceId);
    const t5 = await r5.text();
    results.sessionV2 = { status: r5.status, body: t5.substring(0, 500) };
  } catch (e) { results.sessionV2 = { error: e.message }; }

  return jsonResponse({
    success: true, results,
    tokenLength: token.length,
    tokenStart: token.substring(0, 20),
    deviceIdUsed: deviceId || DEFAULT_DEVICE_ID
  });
}

// ─── Route: Health check ───
function handleHealth() {
  return jsonResponse({
    status: 'ok',
    message: 'Arlo Camera PWA API',
    deviceId: DEFAULT_DEVICE_ID,
    timestamp: new Date().toISOString()
  });
}

// ─── Main Handler ───
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname;
  const path = rawPath
    .replace(/^\/?\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/$/, '')
    || '/';
  const method = req.method;

  console.log(`[Arlo API] ${method} ${rawPath} → path: "${path}"`);

  const token = req.headers.get('x-arlo-token') || req.headers.get('authorization');
  // Use consistent device ID from frontend (stored in localStorage) for session binding
  const clientDeviceId = req.headers.get('x-arlo-device-id');
  console.log(`[Arlo API] Client Device-Id: ${clientDeviceId || 'none (using server default)'}`);


  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try { body = await req.json(); } catch (e) { body = {}; }
  }

  const query = Object.fromEntries(url.searchParams);

  try {
    // Health check
    if (path === '/' || path === '/health') return handleHealth();

    // ─── Auth routes (no token needed for login) ───
    if (path === '/login' && method === 'POST') return handleLogin(body, clientDeviceId);
    if (path === '/get-factors' && method === 'POST') return handleGetFactors(body, clientDeviceId);
    if (path === '/start-auth' && method === 'POST') return handleStartAuth(body, clientDeviceId);
    if (path === '/finish-auth' && method === 'POST') return handleFinishAuth(body, clientDeviceId);

    // All other routes need token
    if (!token) return errorResponse('Token obligatwa. Konekte avan.', 401);

    // Device routes
    if (path === '/devices' && method === 'GET') return handleGetDevices(token, clientDeviceId);
    if (path === '/devices-raw' && method === 'GET') return handleGetDevicesRaw(token, clientDeviceId);
    if (path === '/debug-session' && method === 'GET') return handleDebugSession(token, clientDeviceId);
    if (path === '/modes' && method === 'GET') return handleGetModes(token, clientDeviceId);
    if (path === '/mode' && method === 'POST') return handleSetMode(token, body, clientDeviceId);
    if (path === '/snapshot' && method === 'POST') return handleSnapshot(token, body, clientDeviceId);
    if (path === '/stream' && method === 'POST') return handleStream(token, body, clientDeviceId);
    if (path === '/library' && method === 'GET') return handleLibrary(token, query, clientDeviceId);

    return errorResponse('Route pa egziste: ' + path, 404);
  } catch (err) {
    console.error('[Arlo API] Error:', err.message);
    return errorResponse('Erè entèn: ' + err.message, 500);
  }
}
