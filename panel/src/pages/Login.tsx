import { useState, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Ingresa tu usuario')
    .max(50, 'Usuario demasiado largo'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña')
    .max(100, 'Contraseña demasiado larga'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function Login() {
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [brand, setBrand] = useState({ brand: 'ATU Retransmisor GPS', company: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    api.getBrand().then(data => {
      if (data.brand) setBrand(data);
    }).catch(() => {});
  }, []);

  const detectCapsLock = (e: KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setSubmitError('');
    try {
      await login(data.username, data.password);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed');
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

        <form onSubmit={handleSubmit(onSubmit)} className="login-form" noValidate>
          {submitError && (
            <div className="login-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              placeholder="usuario"
              autoComplete="username"
              autoFocus
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
              disabled={isSubmitting}
              {...register('username')}
            />
            {errors.username && (
              <span id="username-error" className="field-error" role="alert">
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="........"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                disabled={isSubmitting}
                onKeyDown={detectCapsLock}
                onKeyUp={detectCapsLock}
                {...register('password')}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <span id="password-error" className="field-error" role="alert">
                {errors.password.message}
              </span>
            )}
            {capsLockOn && (
              <span className="field-warning" role="status">
                Bloq Mayus activado
              </span>
            )}
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isSubmitting || !isValid}
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
