/**
 * Config Page
 * ATU configuration viewer and controls
 */

import { useState, useEffect } from 'react';
import { api, AtuConfig, HealthStatus } from '../api/client';

function Config() {
  const [config, setConfig] = useState<AtuConfig | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detailComponent, setDetailComponent] = useState<string | null>(null);

  const fetchConfigAndHealth = async () => {
    try {
      setError(null);
      const [configData, healthData] = await Promise.all([
        api.getConfig(),
        api.getHealth(),
      ]);
      setConfig(configData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndHealth();
  }, []);

  const handleStartTransmission = async () => {
    try {
      setActionLoading('start');
      setActionMessage(null);
      const result = await api.startTransmission();
      setActionMessage({ type: 'success', text: result.message });
      // Refresh status
      setTimeout(fetchConfigAndHealth, 500);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo iniciar la transmisión',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopTransmission = async () => {
    try {
      setActionLoading('stop');
      setActionMessage(null);
      const result = await api.stopTransmission();
      setActionMessage({ type: 'success', text: result.message });
      // Refresh status
      setTimeout(fetchConfigAndHealth, 500);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo detener la transmisión',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleDryRun = async () => {
    if (!config) return;
    try {
      setActionLoading('config');
      setActionMessage(null);
      const result = await api.updateConfig({ dryRun: !config.dryRun });
      setActionMessage({ type: 'success', text: result.message });
      // Refresh config
      setTimeout(fetchConfigAndHealth, 500);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo actualizar la configuración',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getHealthStatusClass = (status: string): string => {
    if (status === 'up') return 'up';
    if (status === 'down') return 'down';
    return 'unknown';
  };

  const getHealthLabel = (status: string): string => {
    if (status === 'up') return 'Operativo';
    if (status === 'down') return 'Caído';
    return 'Desconocido';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-title">Configuración</h2>
        <p className="page-subtitle">Ajustes y controles del retransmisor ATU GPS</p>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`panel mb-4 ${actionMessage.type === 'success' ? 'panel-success' : 'panel-error'}`}
          style={{
            padding: '12px 16px',
            background: actionMessage.type === 'success'
              ? 'rgba(34, 197, 94, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          }}
        >
          <span style={{ color: actionMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {actionMessage.text}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state mb-4">
          <p>{error}</p>
          <button className="btn btn-primary mt-4" onClick={fetchConfigAndHealth}>
            Reintentar
          </button>
        </div>
      )}

      {/* ATU Configuration Section */}
      <div className="config-section">
        <h3 className="config-section-title">Conexión ATU</h3>

        <div className="config-grid">
          <div className="config-display-item readonly">
            <span className="label">Entorno</span>
            <span className="value">
              <span className={`mode-badge ${config?.env}`} style={{ marginTop: '4px' }}>
                {config?.env?.toUpperCase()}
              </span>
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Punto WebSocket</span>
            <span className="value endpoint-display">
              {config?.endpoint ? (
                <>
                  {config.endpoint.split('?')[0]}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                    ?token=***
                  </span>
                </>
              ) : (
                '—'
              )}
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Token</span>
            <span className="value token-display">
              {config?.token || '—'}
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Intervalo máximo de actualización</span>
            <span className="value">
              {config?.maxUpdateIntervalSeconds ?? '—'} segundos
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Edad máxima de posición</span>
            <span className="value">
              {config?.position?.maxAgeMinutes ?? '—'} minutes
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Reintentos máximos</span>
            <span className="value">
              {config?.maxRetries ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* GPS Source Section */}
      <div className="config-section">
        <h3 className="config-section-title">Fuente GPS</h3>

        <div className="config-grid">
          <div className="config-display-item readonly">
            <span className="label">Tipo de fuente</span>
            <span className="value">{config?.gps?.sourceType || '—'}</span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Intervalo de consulta</span>
            <span className="value">
              {config?.gps?.pollIntervalMs ? `${config.gps.pollIntervalMs}ms` : '—'}
            </span>
          </div>

          <div className="config-display-item readonly">
            <span className="label">Unidad de velocidad</span>
            <span className="value">{config?.gps?.speedUnit || '—'}</span>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="config-section">
        <h3 className="config-section-title">Controles</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <span className="filter-label">Modo prueba:</span>
          <div
            className="toggle-container"
            style={{ cursor: actionLoading ? 'not-allowed' : 'pointer' }}
            onClick={() => !actionLoading && handleToggleDryRun()}
          >
            <div className={`toggle ${config?.dryRun ? 'active' : ''}`}>
              <div className="toggle-knob" />
            </div>
            <span className="toggle-label">
              {config?.dryRun ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>

        <div className="config-controls">
          <button
            className="btn btn-success"
            onClick={handleStartTransmission}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'start' ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
                Iniciando...
              </>
            ) : (
              '▶ Iniciar transmisión'
            )}
          </button>

          <button
            className="btn btn-danger"
            onClick={handleStopTransmission}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'stop' ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
                Deteniendo...
              </>
            ) : (
              '■ Detener transmisión'
            )}
          </button>
        </div>
      </div>

      {/* Health Indicators */}
      <div className="config-section">
        <h3 className="config-section-title">Estado del sistema</h3>

        <div className="health-indicators">
          <div className="health-item">
            <div className="health-item-label">Fuente GPS</div>
            <div className={`health-item-status ${getHealthStatusClass(health?.components?.gpsSource?.status || 'unknown')}`}>
              {getHealthLabel(health?.components?.gpsSource?.status || 'unknown')}
            </div>
            {health?.components?.gpsSource?.message && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {health.components.gpsSource.message.split(',')[0]}
              </div>
            )}
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '3px 10px' }}
              onClick={() => setDetailComponent(detailComponent === 'gps' ? null : 'gps')}
            >
              {detailComponent === 'gps' ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
            {detailComponent === 'gps' && (
              <div style={{
                marginTop: '8px', padding: '10px 12px', background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', lineHeight: '1.6', width: '100%',
              }}>
                <div><strong>Status real:</strong> {health?.components?.gpsSource?.status || 'unknown'}</div>
                {health?.components?.gpsSource?.message && <div><strong>Mensaje completo:</strong> {health.components.gpsSource.message}</div>}
                {health?.components?.gpsSource?.lastCheck && <div><strong>Última verificación:</strong> {new Date(health.components.gpsSource.lastCheck).toLocaleString('es-ES')}</div>}
                {health?.components?.gpsSource?.lastError && <div><strong>Último error:</strong> <span style={{ color: 'var(--accent-red)' }}>{health.components.gpsSource.lastError}</span></div>}
                {!health?.components?.gpsSource?.message && !health?.components?.gpsSource?.lastError && (
                  <div style={{ color: 'var(--text-muted)' }}>Sin información adicional disponible</div>
                )}
              </div>
            )}
          </div>

          <div className="health-item">
            <div className="health-item-label">WebSocket</div>
            <div className={`health-item-status ${getHealthStatusClass(health?.components?.atuWebsocket?.status || 'unknown')}`}>
              {getHealthLabel(health?.components?.atuWebsocket?.status || 'unknown')}
            </div>
            {health?.components?.atuWebsocket?.message && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {health.components.atuWebsocket.message.split(',')[0]}
              </div>
            )}
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '3px 10px' }}
              onClick={() => setDetailComponent(detailComponent === 'websocket' ? null : 'websocket')}
            >
              {detailComponent === 'websocket' ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
            {detailComponent === 'websocket' && (
              <div style={{
                marginTop: '8px', padding: '10px 12px', background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', lineHeight: '1.6', width: '100%',
              }}>
                <div><strong>Status real:</strong> {health?.components?.atuWebsocket?.status || 'unknown'}</div>
                {health?.components?.atuWebsocket?.message && <div><strong>Mensaje completo:</strong> {health.components.atuWebsocket.message}</div>}
                {health?.components?.atuWebsocket?.lastCheck && <div><strong>Última verificación:</strong> {new Date(health.components.atuWebsocket.lastCheck).toLocaleString('es-ES')}</div>}
                {health?.components?.atuWebsocket?.lastError && <div><strong>Último error:</strong> <span style={{ color: 'var(--accent-red)' }}>{health.components.atuWebsocket.lastError}</span></div>}
                {!health?.components?.atuWebsocket?.message && !health?.components?.atuWebsocket?.lastError && (
                  <div style={{ color: 'var(--text-muted)' }}>Sin información adicional disponible</div>
                )}
              </div>
            )}
          </div>

          <div className="health-item">
            <div className="health-item-label">Base de datos</div>
            <div className={`health-item-status ${getHealthStatusClass(health?.components?.database?.status || 'unknown')}`}>
              {getHealthLabel(health?.components?.database?.status || 'unknown')}
            </div>
            {health?.components?.database?.message && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {health.components.database.message.split(',')[0]}
              </div>
            )}
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '3px 10px' }}
              onClick={() => setDetailComponent(detailComponent === 'database' ? null : 'database')}
            >
              {detailComponent === 'database' ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
            {detailComponent === 'database' && (
              <div style={{
                marginTop: '8px', padding: '10px 12px', background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', lineHeight: '1.6', width: '100%',
              }}>
                <div><strong>Status real:</strong> {health?.components?.database?.status || 'unknown'}</div>
                {health?.components?.database?.message && <div><strong>Mensaje completo:</strong> {health.components.database.message}</div>}
                {health?.components?.database?.lastCheck && <div><strong>Última verificación:</strong> {new Date(health.components.database.lastCheck).toLocaleString('es-ES')}</div>}
                {health?.components?.database?.lastError && <div><strong>Último error:</strong> <span style={{ color: 'var(--accent-red)' }}>{health.components.database.lastError}</span></div>}
                {!health?.components?.database?.message && !health?.components?.database?.lastError && (
                  <div style={{ color: 'var(--text-muted)' }}>Sin información adicional disponible</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Config;
