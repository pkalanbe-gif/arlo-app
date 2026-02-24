import { useArlo } from '../context/ArloContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { logout, baseStations, cameras, userId } = useArlo();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="settings-page fade-in">
      <p className="section-title">Kont</p>
      <div className="settings-group">
        <div className="settings-item" style={{ cursor: 'default' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon">👤</span>
            <div>
              <div className="settings-item-label">Kont Arlo</div>
              <div className="settings-item-desc">{userId || 'Konekte'}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="section-title">Aparèy</p>
      <div className="settings-group">
        <div className="settings-item" style={{ cursor: 'default' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon">📡</span>
            <div>
              <div className="settings-item-label">Stasyon Baz</div>
              <div className="settings-item-desc">{baseStations.length} konekte</div>
            </div>
          </div>
          <span className="settings-item-arrow">{baseStations.length}</span>
        </div>

        <div className="settings-item" style={{ cursor: 'default' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon">📷</span>
            <div>
              <div className="settings-item-label">Kamera</div>
              <div className="settings-item-desc">{cameras.length} konekte</div>
            </div>
          </div>
          <span className="settings-item-arrow">{cameras.length}</span>
        </div>
      </div>

      <p className="section-title">App</p>
      <div className="settings-group">
        <div className="settings-item" style={{ cursor: 'default' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon">📱</span>
            <div>
              <div className="settings-item-label">Vèsyon</div>
              <div className="settings-item-desc">Arlo Cam PWA v1.0.0</div>
            </div>
          </div>
        </div>

        <div className="settings-item" style={{ cursor: 'default' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon">🌐</span>
            <div>
              <div className="settings-item-label">Enstale App</div>
              <div className="settings-item-desc">Ajoute sou ekran Android ou</div>
            </div>
          </div>
          <span className="settings-item-arrow">→</span>
        </div>
      </div>

      <p className="section-title">Sekirite</p>
      <div className="settings-group">
        <div className="settings-item" onClick={handleLogout} style={{ borderColor: 'rgba(255, 82, 82, 0.3)' }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ background: 'rgba(255, 82, 82, 0.15)' }}>🚪</span>
            <div>
              <div className="settings-item-label" style={{ color: 'var(--red)' }}>Dekonekte</div>
              <div className="settings-item-desc">Sòti nan kont Arlo ou</div>
            </div>
          </div>
          <span className="settings-item-arrow" style={{ color: 'var(--red)' }}>→</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: '12px' }}>
        Arlo Cam PWA — Kreye ak ❤️ pou Pippen
      </div>
    </div>
  );
}
