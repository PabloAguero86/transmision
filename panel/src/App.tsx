/**
 * ATU GPS Forwarder Panel — Main App Component
 * React Router setup with navigation, layout, and auth protection
 */

import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Transmissions from './pages/Transmissions';
import Alerts from './pages/Alerts';
import Config from './pages/Config';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { api, AtuStatus } from './api/client';
import './App.css';

function AppLayout({ children }: { children: React.ReactNode }) {
  const [atuStatus, setAtuStatus] = useState<AtuStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch status on mount and set up polling
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await api.getStatus();
        setAtuStatus(status);
        setIsConnected(status.websocketConnected);
      } catch {
        setIsConnected(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <h1>ATU Retransmisor GPS</h1>
          {atuStatus && (
            <span className={`mode-badge ${atuStatus.mode}`}>
              {atuStatus.mode}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className={`topbar-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Panel
          </NavLink>
          <NavLink
            to="/transmissions"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Transmisiones
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Alertas
          </NavLink>
          <NavLink
            to="/config"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Configuración
          </NavLink>
        </nav>

        {/* Connection Status & User */}
        <div className="topbar-status">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="connection-dot" />
            {isConnected ? 'Conectado a ATU' : 'Desconectado'}
          </div>
          {user && (
            <div className="user-menu">
              <span className="user-name">{user.username}</span>
              <button className="logout-btn" onClick={handleLogout}>
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transmissions" element={<Transmissions />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/config" element={<Config />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
