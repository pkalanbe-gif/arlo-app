import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArlo } from '../context/ArloContext';

export default function Dashboard() {
  const { cameras, baseStations, loading, loadDevices, changeMode, currentMode, error } = useArlo();
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState(currentMode || 'mode0');

  useEffect(() => {
    if (currentMode) setActiveMode(currentMode);
  }, [currentMode]);

  const modes = [
    { id: 'mode1', label: 'Aktive', icon: '🛡️', className: 'armed', desc: 'An absans' },
    { id: 'mode0', label: 'Veye', icon: '🏠', className: 'home', desc: 'An prezans' },
    { id: 'mode2', label: 'Dòmi', icon: '😴', className: 'standby', desc: 'Dezaktive' }
  ];

  const handleModeChange = async (mode) => {
    if (baseStations.length === 0) return;
    const bs = baseStations[0];
    setActiveMode(mode);
    await changeMode(bs.deviceId, bs.xCloudId, mode);
  };

  const handleCameraClick = (camera) => {
    navigate(`/camera/${camera.deviceId}`, { state: { camera } });
  };

  if (loading && cameras.length === 0) {
    return (
      <div className="loading-container fade-in">
        <div className="spinner"></div>
        <p className="loading-text">Ap chaje aparèy yo...</p>
      </div>
    );
  }

  return (
    <div className="dashboard fade-in">
      {/* Modes */}
      <p className="section-title">Mòd Sekirite</p>
      <div className="modes-grid">
        {modes.map(mode => (
          <div
            key={mode.id}
            className={`mode-card ${mode.className} ${activeMode === mode.id ? 'active' : ''}`}
            onClick={() => handleModeChange(mode.id)}
          >
            <div className="mode-icon">{mode.icon}</div>
            <div className="mode-label">{mode.label}</div>
          </div>
        ))}
      </div>

      {/* Base Stations */}
      {baseStations.length > 0 && (
        <>
          <p className="section-title">Stasyon Baz</p>
          <div className="camera-grid" style={{ marginBottom: '24px' }}>
            {baseStations.map(bs => (
              <div key={bs.deviceId} className="camera-card" style={{ cursor: 'default' }}>
                <div className="camera-info">
                  <div>
                    <div className="camera-name">📡 {bs.deviceName}</div>
                    <div className="camera-location">Base Station • {bs.modelId || 'VMB5000'}</div>
                  </div>
                  <span className={`status-badge ${bs.state?.connectionState === 'available' ? 'status-online' : 'status-offline'}`}>
                    <span className={`status-dot ${bs.state?.connectionState === 'available' ? 'online' : 'offline'}`}></span>
                    {bs.state?.connectionState === 'available' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cameras */}
      <p className="section-title">Kamera yo</p>
      {cameras.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <p className="empty-text">
            {loading ? 'Ap chache kamera...' : 'Pa gen kamera konekte. Asire baz stasyon an online.'}
          </p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: '16px', width: 'auto', display: 'inline-flex' }}
            onClick={loadDevices}
          >
            🔄 Rafrechi
          </button>
        </div>
      ) : (
        <div className="camera-grid">
          {cameras.map(cam => (
            <div key={cam.deviceId} className="camera-card" onClick={() => handleCameraClick(cam)}>
              <div className="camera-preview">
                {cam.properties?.lastImageUrl ? (
                  <img src={cam.properties.lastImageUrl} alt={cam.deviceName} />
                ) : (
                  <span className="no-preview">📹</span>
                )}
                {cam.state?.connectionState === 'available' && (
                  <span className="live-badge">LIVE</span>
                )}
              </div>
              <div className="camera-info">
                <div>
                  <div className="camera-name">{cam.deviceName}</div>
                  <div className="camera-location">
                    {cam.properties?.batteryLevel != null
                      ? `🔋 ${cam.properties.batteryLevel}%`
                      : cam.modelId || 'Kamera'}
                  </div>
                </div>
                <span className={`status-badge ${cam.state?.connectionState === 'available' ? 'status-online' : 'status-offline'}`}>
                  <span className={`status-dot ${cam.state?.connectionState === 'available' ? 'online' : 'offline'}`}></span>
                  {cam.state?.connectionState === 'available' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <button className="btn btn-secondary" onClick={loadDevices} disabled={loading} style={{ width: 'auto', display: 'inline-flex' }}>
          {loading ? '⏳ Ap rafrechi...' : '🔄 Rafrechi aparèy yo'}
        </button>
      </div>
    </div>
  );
}
