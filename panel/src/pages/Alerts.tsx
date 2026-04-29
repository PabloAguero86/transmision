/**
 * Alerts Page
 * Alert management view with severity-based filtering
 */

import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface AlertItem {
  code: string;
  message: string;
  count: number;
  severity: 'info' | 'warning' | 'critical';
  firstSeen?: string;
}

function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

  const fetchAlerts = async () => {
    try {
      setError(null);
      const report = await api.getAtuErrorsReport();

      // Transform errors into alert items with severity
      const alertItems: AlertItem[] = report.errors.map((err) => {
        let severity: 'info' | 'warning' | 'critical' = 'info';
        const code = err.code.toLowerCase();
        const message = err.message.toLowerCase();

        if (
          code.includes('timeout') ||
          code.includes('connection') ||
          code.includes('econnrefused') ||
          code.includes('socket')
        ) {
          severity = 'critical';
        } else if (
          code.includes('invalid') ||
          code.includes('expired') ||
          code.includes('unauthorized') ||
          message.includes('token')
        ) {
          severity = 'warning';
        }

        return {
          code: err.code,
          message: err.message,
          count: err.count,
          severity,
        };
      });

      setAlerts(alertItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las alertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter === 'all') return true;
    return alert.severity === severityFilter;
  });

  const getSeverityBadgeClass = (severity: 'info' | 'warning' | 'critical'): string => {
    return severity;
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
        <h2 className="page-title">Alertas</h2>
        <p className="page-subtitle">Alertas del sistema y seguimiento de errores</p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Severidad:</span>
          <select
            className="filter-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
          >
            <option value="all">Todas</option>
            <option value="critical">Crítica</option>
            <option value="warning">Advertencia</option>
            <option value="info">Información</option>
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-state mb-4">
          <p>{error}</p>
            <button className="btn btn-primary mt-4" onClick={fetchAlerts}>
            Reintentar
          </button>
        </div>
      )}

      {/* Alerts List */}
      <div className="panel">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <p className="empty-state-title">Sin alertas</p>
            <p className="empty-state-text">
              {severityFilter !== 'all'
                ? `No hay alertas de tipo ${severityFilter} en el sistema`
                : 'El sistema funciona con normalidad, sin errores detectados'}
            </p>
          </div>
        ) : (
          <div className="alert-list" style={{ padding: '16px' }}>
            {filteredAlerts.map((alert, idx) => (
              <div key={idx} className={`alert-card ${alert.severity}`}>
                <div className="alert-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`severity-indicator ${alert.severity}`} />
                    <span className="alert-type">{alert.severity.toUpperCase()}</span>
                    <span
                      className={`status-badge ${getSeverityBadgeClass(alert.severity)}`}
                      style={{ fontSize: '0.7rem' }}
                    >
                      Count: {alert.count}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {alert.code}
                  </span>
                </div>
                      <div className="alert-title">Error ATU: {alert.code}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-meta">
                  Total occurrences: {alert.count}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Statistics */}
      {alerts.length > 0 && (
        <div className="info-row mt-6">
          <div className="info-item">
            <span className="info-label">Errores totales</span>
            <span className="info-value large">
              {alerts.reduce((sum, a) => sum + a.count, 0)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Critical</span>
            <span className="info-value large" style={{ color: 'var(--accent-red)' }}>
              {alerts.filter((a) => a.severity === 'critical').length}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Advertencia</span>
            <span className="info-value large" style={{ color: 'var(--accent-orange)' }}>
              {alerts.filter((a) => a.severity === 'warning').length}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Información</span>
            <span className="info-value large" style={{ color: 'var(--accent-blue)' }}>
              {alerts.filter((a) => a.severity === 'info').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;
