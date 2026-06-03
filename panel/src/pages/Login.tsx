import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brand, setBrand] = useState({ brand: 'ATU Retransmisor GPS', company: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getBrand().then(data => {
      if (data.brand) setBrand(data);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#1e3a5f" />
              <path d="M24 14L30 20H26V28H22V20H18L24 14Z" fill="#3b82f6" />
              <path d="M14 30C14 30 18 34 24 34C30 34 34 30 34 30" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="34" r="2" fill="#22c55e"/>
            </svg>
          </div>
          <h1 className="login-brand">{brand.brand}</h1>
          {brand.company && <p className="login-company">{brand.company}</p>}
          {!brand.company && <p className="login-subtitle">Panel de Administracion</p>}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="login-btn-spinner" />
                Ingresando...
              </>
            ) : 'Ingresar'}
          </button>
        </form>

        <div className="login-footer">
          <span>Sistema de Retransmision GPS &middot; ATU</span>
        </div>
      </div>
    </div>
  );
}

export default Login;