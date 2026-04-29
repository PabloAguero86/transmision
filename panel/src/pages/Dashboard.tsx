/**
 * Dashboard Page
 * Real-time ATU transmission status with metrics, recent transmissions, and alerts
 */

import { useState, useEffect } from 'react';
import { api, AtuStatus, TransmissionRecord, VehicleWithoutTransmission, AtuErrorReport } from '../api/client';

interface DashboardData {
  status: AtuStatus;
  recentTransmissions: TransmissionRecord[];
  vehiclesWithoutUpdate: VehicleWithoutTransmission[];
  errors: AtuErrorReport;
  avgLatency: number;
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [status, latest, vehicles, errorsReport] = await Promise.all([
        api.getStatus(),
        api.getLatestTransmissions(10),
        api.getVehiclesWithoutTransmission(20),
        api.getAtuErrorsReport(),
      ]);

      // Calculate average latency from recent transmissions
      const latencies = latest.records
        .filter((t) => t.latency_ms !== null && t.latency_ms > 0)
        .map((t) => t.latency_ms as number);

      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

      setData({
        status,
        recentTransmissions: latest.records,
        vehiclesWithoutUpdate: vehicles.vehicles,
        errors: errorsReport,
        avgLatency,
      });
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos del panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusClass = (status: string): string => {
    if (status === 'accepted_by_atu') return 'accepted';
    if (status === 'rejected_by_atu') return 'rejected';
    if (status === 'expired') return 'expired';
    if (status === 'validation_failed') return 'validation_failed';
    return 'pending';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      accepted_by_atu: 'ACEPTADO',
      rejected_by_atu: 'RECHAZADO',
      expired: 'EXPIRADO',
      validation_failed: 'VALIDACIÓN',
      pending: 'PENDIENTE',
      token_error: 'TOKEN',
      websocket_error: 'WEBSOCKET',
    };
    return labels[status] || status.toUpperCase();
  };

  const getLatencyClass = (ms: number | null): string => {
    if (ms === null) return '';
    if (ms < 500) return 'fast';
    if (ms < 1500) return 'medium';
    return 'slow';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error al cargar el panel: {error}</p>
        <button className="btn btn-primary mt-4" onClick={fetchDashboardData}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { status, recentTransmissions, vehiclesWithoutUpdate, errors, avgLatency } = data;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="page-title">Panel</h2>
          <p className="page-subtitle">Monitoreo en tiempo real de transmisiones ATU</p>
        </div>
        <div className="refresh-indicator">
          <span className="refresh-dot" />
          Última actualización: {formatTimestamp(lastRefresh.toISOString())}
        </div>
      </div>

      {/* Connection & Mode Badges */}
      <div className="flex gap-4 mb-6">
        <div className={`status-badge ${status.websocketConnected ? 'connected' : 'disconnected'}`}>
          {status.websocketConnected ? 'Conectado a ATU' : 'Desconectado'}
        </div>
        <div className={`status-badge ${status.mode}`}>
          {status.mode.toUpperCase()}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-label">Enviadas</span>
            <span className="metric-icon">📤</span>
          </div>
          <div className="metric-value">{status.totalTransmissions.toLocaleString()}</div>
        </div>

        <div className="metric-card accepted">
          <div className="metric-card-header">
            <span className="metric-label">Aceptadas</span>
            <span className="metric-icon">✓</span>
          </div>
          <div className="metric-value">{status.acceptedCount.toLocaleString()}</div>
        </div>

        <div className="metric-card rejected">
          <div className="metric-card-header">
            <span className="metric-label">Rechazadas</span>
            <span className="metric-icon">✗</span>
          </div>
          <div className="metric-value">{status.rejectedCount.toLocaleString()}</div>
        </div>

        <div className="metric-card active">
          <div className="metric-card-header">
            <span className="metric-label">Vehículos activos</span>
            <span className="metric-icon">🚗</span>
          </div>
          <div className="metric-value">{status.vehiclesActive}</div>
        </div>
      </div>

      {/* Info Row: Latency, Last Transmission */}
      <div className="info-row">
        <div className="info-item">
          <span className="info-label">Latencia promedio</span>
          <span className={`info-value large ${getLatencyClass(avgLatency)}`}>
            {avgLatency > 0 ? `${avgLatency} ms` : '—'}
          </span>
        </div>

        <div className="info-item">
          <span className="info-label">Última transmisión</span>
          <span className="info-value">
            {formatTimestamp(status.lastTransmissionAt)}
          </span>
        </div>

        {status.lastAtuResponse && (
          <div className="info-item">
            <span className="info-label">Última respuesta ATU</span>
            <span className="info-value">
              Código: {status.lastAtuResponse.code}
            </span>
          </div>
        )}
      </div>

      {/* Vehicles Without Update */}
      {vehiclesWithoutUpdate.length > 0 && (
        <div className="panel mb-6">
          <div className="panel-header">
            <span className="panel-title">⚠️ Vehículos sin actualización &gt;20s</span>
            <span className="count-badge warning">{vehiclesWithoutUpdate.length}</span>
          </div>
          <div className="panel-body">
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vehiclesWithoutUpdate.map((v) => (
                <li
                  key={v.imei}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                  }}
                >
                  <span style={{ fontFamily: 'monospace' }}>{v.imei}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Último: {formatTimestamp(v.lastTransmissionAt)} (hace {v.gapSeconds}s)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Recent Transmissions Table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Últimas 10 transmisiones</span>
          </div>
          <div className="panel-scroll">
            {recentTransmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📡</div>
                <p className="empty-state-title">Aún no hay transmisiones</p>
                <p className="empty-state-text">Las transmisiones aparecerán aquí cuando el sistema inicie</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>IMEI</th>
                    <th>Ruta</th>
                    <th>Código</th>
                    <th>Latencia</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransmissions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.license_plate}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.imei}</td>
                      <td>{t.route_id}</td>
                      <td>
                        <span className={`status-pill ${getStatusClass(t.status)}`}>
                          {t.atu_response_code || getStatusLabel(t.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`latency-value ${getLatencyClass(t.latency_ms)}`}>
                          {t.latency_ms !== null ? `${t.latency_ms}ms` : '—'}
                        </span>
                      </td>
                      <td className="timestamp">{formatTimestamp(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🚨 Alertas activas</span>
          </div>
          <div className="panel-body">
            {errors.errors.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon">✨</div>
                <p className="empty-state-title">Sin alertas activas</p>
                <p className="empty-state-text">El sistema funciona con normalidad</p>
              </div>
            ) : (
              <div className="alert-list">
                {errors.errors.slice(0, 5).map((err, idx) => {
                  // Determine severity based on error code
                  let severity: 'info' | 'warning' | 'critical' = 'info';
                  const code = err.code.toLowerCase();
                  if (code.includes('timeout') || code.includes('connection')) {
                    severity = 'critical';
                  } else if (code.includes('invalid') || code.includes('expired')) {
                    severity = 'warning';
                  }

                  return (
                    <div key={idx} className={`alert-card ${severity}`}>
                      <div className="alert-header">
                        <span className="alert-type">{severity.toUpperCase()}</span>
                      </div>
                      <div className="alert-title">Código de error: {err.code}</div>
                      <div className="alert-message">{err.message}</div>
                      <div className="alert-meta">Cantidad: {err.count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
