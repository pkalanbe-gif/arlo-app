import { useState, useEffect } from 'react';
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
  const [snapshotUrl, setSnapshotUrl] = useState(camera?.properties?.lastImageUrl || null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);

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
    if (!parentStation) return;
    setLoadingAction('snapshot');
    try {
      const result = await takeSnapshot(camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      if (result?.data?.url) {
        setSnapshotUrl(result.data.url);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStream = async () => {
    if (!parentStation) return;
    setLoadingAction('stream');
    try {
      const result = await startStream(camera.deviceId, parentStation.deviceId, parentStation.xCloudId);
      if (result?.url) {
        setStreamUrl(result.url);
        setIsStreaming(true);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStopStream = () => {
    setStreamUrl(null);
    setIsStreaming(false);
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
        {isStreaming && streamUrl ? (
          <video
            src={streamUrl}
            autoPlay
            playsInline
            muted
            controls
            style={{ width: '100%', height: '100%' }}
          />
        ) : snapshotUrl ? (
          <img src={snapshotUrl} alt={camera.deviceName} />
        ) : (
          <div className="stream-placeholder">
            <div className="big-icon">📹</div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isOnline ? 'Klike pou wè kamera a' : 'Kamera offline'}
            </p>
          </div>
        )}

        {isStreaming && <span className="live-badge" style={{ position: 'absolute', top: 12, left: 12 }}>● LIVE</span>}
      </div>

      {/* Controls */}
      <div className="camera-controls">
        <button
          className="control-btn"
          onClick={handleSnapshot}
          disabled={!isOnline || loadingAction === 'snapshot'}
          title="Pran Foto"
        >
          {loadingAction === 'snapshot' ? '⏳' : '📸'}
        </button>

        <button
          className={`control-btn ${isStreaming ? 'record' : ''}`}
          onClick={isStreaming ? handleStopStream : handleStream}
          disabled={!isOnline || loadingAction === 'stream'}
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
      </div>
    </div>
  );
}
