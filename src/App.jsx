import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ArloProvider, useArlo } from './context/ArloContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CameraView from './components/CameraView';
import Library from './components/Library';
import Settings from './components/Settings';
import Navbar from './components/Navbar';
import './styles/App.css';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useArlo();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isLoggedIn } = useArlo();

  return (
    <>
      {/* Header for main pages */}
      {isLoggedIn && (
        <Routes>
          <Route path="/login" element={null} />
          <Route path="/camera/:deviceId" element={null} />
          <Route path="*" element={
            <header className="header">
              <div className="header-title">
                <span className="cam-icon">📷</span>
                Arlo Cam
              </div>
              <div className="header-actions">
                <button className="header-btn" title="Notifikasyon">🔔</button>
              </div>
            </header>
          } />
        </Routes>
      )}

      {/* Main Content */}
      <div className="app-container">
        <Routes>
          <Route path="/login" element={
            isLoggedIn ? <Navigate to="/" replace /> : <Login />
          } />
          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/camera/:deviceId" element={
            <ProtectedRoute><CameraView /></ProtectedRoute>
          } />
          <Route path="/library" element={
            <ProtectedRoute><Library /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Bottom Navigation */}
      <Navbar />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ArloProvider>
        <AppRoutes />
      </ArloProvider>
    </BrowserRouter>
  );
}
