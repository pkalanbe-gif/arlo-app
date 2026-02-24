import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useArlo } from '../context/ArloContext';

export default function CameraView() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cameras, baseStations, takeSnapshot, startStream } = useArlo();

  const camera = location.state?.camera || cameras.find(c => c.deviceId === deviceId);
  const parentStation = baseStations.find(bs => bs.deviceId === camera?.parentId);

  const [streamUrl, setStreamUrl] = useState(null);
  const [streamType, setStreamType] = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState(camera?.properties?.lastImageUrl || null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!camera) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-icon">❌</div>
        <p className="empty-text">Kamera pa jwenn</p>
        <button className="btn btn-secondary" style={{ marginTop: '16px', width: 'auto' }} onClick={() => navigate('/')}>
          ← Retounen
        </button>
      </div>
    );
  }

  const handleSnapshot = async () => {
    if (!parentStation) {
      setActionError('Baz stasyon pa jwenn. Retounen nan Dashboard epi rafrechi.');
      return;
    }
    setLoadingAction('snapshot');
    setActionError(null);
    setStatusMsg('Ap pran foto...');
    try {
      console.log('[CameraView] Taking snapshot:', camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      const result = await takeSnapshot(camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      console.log('[CameraView] Snapshot result:', JSON.stringify(result));

      if (result?.data?.url) {
        setSnapshotUrl(result.data.url);
        setStatusMsg('Foto pran!');
        setIsStreaming(false);
        setStreamUrl(null);
      } else {
        setStatusMsg('Foto mande — li ka pran kèk segonn...');
        // Even if no URL returned, the snapshot was requested.
        // User can try again after a few seconds.
      }
    } catch (err) {
      console.error('[CameraView] Snapshot error:', err);
      setActionError('Pa ka pran foto. Eseye ankò.');
    } finally {
      setLoadingAction(null);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleStream = async () => {
    if (!parentStation) {
      setActionError('Baz stasyon pa jwenn. Retounen nan Dashboard epi rafrechi.');
      return;
    }
    setLoadingAction('stream');
    setActionError(null);
    setStatusMsg('Ap kòmanse stream...');
    try {
      console.log('[CameraView] Starting stream:', camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      const result = await startStream(camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      console.log('[CameraView] Stream result:', JSON.stringify(result));

      if (result?.url) {
        const type = result.streamType || 'unknown';
        setStreamType(type);
        console.log('[CameraView] Stream type:', type, 'URL:', result.url);

        if (type === 'rtsp') {
          // RTSP cannot play in browser directly
          setActionError('Stream RTSP pa ka jwe nan browser. Arlo retounen yon URL RTSP ki bezwen yon media player (VLC).');
          setStatusMsg(null);
        } else {
          setStreamUrl(result.url);
          setIsStreaming(true);
          setStatusMsg('Stream aktif!');
        }
      } else {
        setActionError('Arlo pa retounen URL stream. Kamera a petèt pa disponib kounye a.');
      }
    } catch (err) {
      console.error('[CameraView] Stream error:', err);
      setActionError('Pa ka kòmanse stream. Eseye ankò.');
    } finally {
      setLoadingAction(null);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleStopStream = () => {
    setStreamUrl(null);
    setStreamType(null);
    setIsStreaming(false);
    setStatusMsg(null);
  };

  const isOnline = camera.state?.connectionState === 'available';

  return (
    <div className="camera-view-page fade-in">
      {/* Header */}
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← {camera.deviceName}
        </button>
        <span className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Stream / Preview */}
      <div className="camera-stream">
        {loadingAction && (
          <div className="stream-placeholder">
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
              {loadingAction === 'snapshot' ? 'Ap pran foto...' : 'Ap kòmanse stream...'}
            </p>
          </div>
        )}

        {!loadingAction && isStreaming && streamUrl ? (
          <video
            src={streamUrl}
            autoPlay
            playsInline
            muted
            controls
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              console.error('[CameraView] Video playback error:', e);
              setActionError('Pa ka jwe video stream la. Format la ka pa sipòte nan browser sa a.');
              setIsStreaming(false);
            }}
          />
        ) : !loadingAction && snapshotUrl ? (
          <img
            src={snapshotUrl}
            alt={camera.deviceName}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={() => {
              console.warn('[CameraView] Snapshot image failed to load');
              setSnapshotUrl(null);
            }}
          />
        ) : !loadingAction ? (
          <div className="stream-placeholder">
            <div className="big-icon">📹</div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isOnline ? 'Klike 📸 pou foto oswa ▶️ pou stream' : 'Kamera offline'}
            </p>
          </div>
        ) : null}

        {isStreaming && !loadingAction && <span className="live-badge" style={{ position: 'absolute', top: 12, left: 12 }}>● LIVE</span>}
      </div>

      {/* Status / Error Messages */}
      {(actionError || statusMsg) && (
        <div style={{ padding: '8px 16px', textAlign: 'center' }}>
          {actionError && (
            <p style={{ color: '#ff6b6b', fontSize: '13px', margin: '4px 0' }}>⚠️ {actionError}</p>
          )}
          {statusMsg && !actionError && (
            <p style={{ color: 'var(--accent)', fontSize: '13px', margin: '4px 0' }}>{statusMsg}</p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="camera-controls">
        <button
          className="control-btn"
          onClick={handleSnapshot}
          disabled={!isOnline || !!loadingAction}
          title="Pran Foto"
        >
          {loadingAction === 'snapshot' ? '⏳' : '📸'}
        </button>

        <button
          className={`control-btn ${isStreaming ? 'record' : ''}`}
          onClick={isStreaming ? handleStopStream : handleStream}
          disabled={!isOnline || (!!loadingAction && loadingAction !== 'stream')}
          title={isStreaming ? 'Kanpe Stream' : 'Kòmanse Stream'}
        >
          {loadingAction === 'stream' ? '⏳' : isStreaming ? '⏹️' : '▶️'}
        </button>

        <button className="control-btn" disabled title="Pale (2-way audio)">
          🎤
        </button>

        <button className="control-btn" disabled title="Anrejistre">
          🔴
        </button>
      </div>

      {/* Details */}
      <div className="camera-details">
        <p className="section-title">Enfòmasyon Kamera</p>

        <div className="detail-row">
          <span className="detail-label">Non</span>
          <span className="detail-value">{camera.deviceName}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Modèl</span>
          <span className="detail-value">{camera.modelId || 'Enkonni'}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">ID Aparèy</span>
          <span className="detail-value" style={{ fontSize: '11px', fontFamily: 'monospace' }}>{camera.deviceId}</span>
        </div>

        {camera.firmwareVersion && (
          <div className="detail-row">
            <span className="detail-label">Firmware</span>
            <span className="detail-value">{camera.firmwareVersion}</span>
          </div>
        )}

        {camera.properties?.batteryLevel != null && (
          <div className="detail-row">
            <span className="detail-label">Batri</span>
            <span className="detail-value">🔋 {camera.properties.batteryLevel}%</span>
          </div>
        )}

        {camera.properties?.signalStrength != null && (
          <div className="detail-row">
            <span className="detail-label">Siyal</span>
            <span className="detail-value">📶 {camera.properties.signalStrength}/4</span>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">Estati</span>
          <span className="detail-value">
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>

        {parentStation && (
          <div className="detail-row">
            <span className="detail-label">Baz Stasyon</span>
            <span className="detail-value">📡 {parentStation.deviceName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
