import { useState, useEffect } from 'react';
import { useArlo } from '../context/ArloContext';

export default function Library() {
  const { getLibrary, loading } = useArlo();
  const [recordings, setRecordings] = useState([]);
  const [dateRange, setDateRange] = useState('7'); // days
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, [dateRange]);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - parseInt(dateRange) * 24 * 60 * 60 * 1000);
      const result = await getLibrary(
        from.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      );
      if (result?.recordings) {
        setRecordings(result.recordings);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Group recordings by date
  const groupedRecordings = recordings.reduce((groups, rec) => {
    const date = rec.localCreatedDate || rec.utcCreatedDate?.split(' ')[0] || 'Enkonni';
    if (!groups[date]) groups[date] = [];
    groups[date].push(rec);
    return groups;
  }, {});

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="library-page fade-in">
      <p className="section-title">Bibliyotèk Videyò</p>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { val: '1', label: 'Jodi a' },
          { val: '7', label: '7 jou' },
          { val: '14', label: '14 jou' },
          { val: '30', label: '30 jou' }
        ].map(opt => (
          <button
            key={opt.val}
            className={`btn ${dateRange === opt.val ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px', fontSize: '12px' }}
            onClick={() => setDateRange(opt.val)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Ap chaje anrejistreman yo...</p>
        </div>
      ) : recordings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <p className="empty-text">Pa gen anrejistreman pou peryòd sa a</p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: '16px', width: 'auto', display: 'inline-flex' }}
            onClick={loadLibrary}
          >
            🔄 Rafrechi
          </button>
        </div>
      ) : (
        Object.entries(groupedRecordings).map(([date, recs]) => (
          <div key={date}>
            <div className="library-date">📅 {formatDate(date)}</div>
            {recs.map((rec, i) => (
              <div key={i} className="recording-card" onClick={() => {
                if (rec.presignedContentUrl) {
                  window.open(rec.presignedContentUrl, '_blank');
                }
              }}>
                <div className="recording-thumb">
                  {rec.presignedThumbnailUrl ? (
                    <img src={rec.presignedThumbnailUrl} alt="thumbnail" />
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: '24px' }}>🎬</span>
                  )}
                </div>
                <div className="recording-info">
                  <span className="recording-time">
                    {formatTime(rec.utcCreatedDate || rec.localCreatedDate)}
                  </span>
                  <span className="recording-camera">
                    📷 {rec.deviceName || rec.uniqueId || 'Kamera'}
                  </span>
                  {rec.mediaDurationSecond && (
                    <span className="recording-duration">
                      ⏱ {formatDuration(rec.mediaDurationSecond)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
