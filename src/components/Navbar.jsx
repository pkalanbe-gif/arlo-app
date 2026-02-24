import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', icon: '🏠', label: 'Akèy' },
  { path: '/library', icon: '🎬', label: 'Bibliyotèk' },
  { path: '/settings', icon: '⚙️', label: 'Paramèt' }
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on login or camera view pages
  if (location.pathname === '/login' || location.pathname.startsWith('/camera/')) {
    return null;
  }

  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
