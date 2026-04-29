/**
 * Script de análisis en vivo del forwarder ATU
 * Ejecutar desde la PC donde corre el servidor
 * Uso: node analyze-local.js
 */

const API_BASE = 'http://localhost:3000';
const USERNAME = 'soldeoro';
const PASSWORD = 'soldeoro';

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  return data.token;
}

async function analyze(token) {
  const headers = { Authorization: `Bearer ${token}` };

  const [payloadsRes, statusRes, configRes] = await Promise.all([
    fetch(`${API_BASE}/debug/payloads-all`, { headers }),
    fetch(`${API_BASE}/atu/status`, { headers }),
    fetch(`${API_BASE}/debug/config`, { headers }),
  ]);

  if (!payloadsRes.ok) throw new Error(`Payloads error: ${payloadsRes.status}`);
  if (!statusRes.ok) throw new Error(`Status error: ${statusRes.status}`);

  const payloadsData = await payloadsRes.json();
  const statusData = await statusRes.json();
  const configData = await configRes.json();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMEN ATU GPS FORWARDER');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Config
  console.log('⚙️  CONFIGURACIÓN');
  console.log('   Ruta ATU:', configData.route?.atuRouteCode || '—');
  console.log('   Ruta ID:', configData.route?.id || '—');
  console.log('   Modo:', configData.dryRun ? 'DRY RUN' : 'PRODUCCIÓN');
  console.log('   Poll interval:', configData.gps?.pollIntervalMs + 'ms');
  console.log('');

  // Status
  console.log('📡 ESTADO DEL SISTEMA');
  console.log('   WebSocket:', statusData.websocketConnected ? '✅ Conectado' : '❌ Desconectado');
  console.log('   Modo:', statusData.mode);
  console.log('   Scheduler:', statusData.transmissionActive ? '🟢 Activo' : '🔴 Detenido');
  console.log('');

  // Vehículos
  console.log('🚗 VEHÍCULOS');
  console.log('   Total en base de datos:', payloadsData.total);
  console.log('   ✅ Válidos (enviados a ATU):', payloadsData.valid);
  console.log('   ❌ Inválidos (no enviados):', payloadsData.invalid);
  console.log('');

  // Detalle por vehículo
  console.log('📋 DETALLE POR VEHÍCULO');
  console.log('─────────────────────────────────────────────────────────────');
  for (const v of payloadsData.payloads) {
    const icon = v.valid ? '✅' : '❌';
    const status = v.valid ? 'ENVIADO' : 'BLOQUEADO';
    console.log(`   ${icon} ${v.plate} (${v.imei}) → ${status}`);
    if (!v.valid && v.errors.length > 0) {
      for (const err of v.errors) {
        console.log(`      ⚠️  ${err.field}: ${err.message}`);
      }
    }
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  // Estadísticas ATU
  console.log('📊 ESTADÍSTICAS ATU');
  console.log('   Total transmisiones:', statusData.totalTransmissions);
  console.log('   Aceptadas (código 00):', statusData.acceptedCount);
  console.log('   Rechazadas:', statusData.rejectedCount);
  console.log('   Vehículos activos:', statusData.vehiclesActive);
  console.log('');

  // Mensajes de respuesta ATU
  console.log('📨 MENSAJES DE RESPUESTA ATU ESPERADOS');
  console.log('   Código 00 → Se recepcionó la trama correctamente');
  console.log('   Código 01 → Verificar el formato de la trama enviada');
  console.log('   Código 03 → InvalidToken');
  console.log('   Código 05 → El identificador de la trama está vacío');
  console.log('   Código 06 → IMEI inválido (15 caracteres alfanuméricos)');
  console.log('   Código 07 → Placa inválida (máx 7 caracteres)');
  console.log('   Código 08 → Coordenadas inválidas');
  console.log('   Código 09 → Velocidad inválida (0-999.99 km/h)');
  console.log('   Código 10 → Operador inválido');
  console.log('   Código 11 → Identificador inválido (máx 50 caracteres)');
  console.log('   Código 12 → ID de ruta inválido (máx 10 caracteres)');
  console.log('   Código 13 → ID de dirección inválido (0 o 1)');
  console.log('   Código 14 → ID de conductor inválido (máx 20 caracteres)');
  console.log('');

  // Problemas comunes
  console.log('🔧 PROBLEMAS ENCONTRADOS');
  if (payloadsData.invalid > 0) {
    const driverErrors = payloadsData.payloads.filter(
      (v) => !v.valid && v.errors.some((e) => e.field === 'driver_id')
    );
    if (driverErrors.length > 0) {
      console.log(`   ❌ ${driverErrors.length} vehículos sin conductor asignado`);
      console.log(`      → driver_id vacío en la base de datos`);
      console.log(`      → SQL: SELECT vh.placa, vh.idgps, vj.idconductor FROM tblvehiculo vh`);
      console.log(`             LEFT JOIN tblviaje vj ON vj.idviaje = vh.uv_idviaje`);
      console.log(`             WHERE vh.idruta = '${configData.route?.id}'`);
    }
  } else {
    console.log('   ✅ Todos los vehículos pasan validación');
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════\n');
}

(async () => {
  try {
    console.log('[Analyzer] Conectando al servidor local...');
    const token = await login();
    await analyze(token);
  } catch (err) {
    console.error('[Analyzer] Error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('   → Asegurate de que el servidor esté corriendo en localhost:3000');
    }
    if (err.message.includes('fetch failed')) {
      console.error('   → Verifica que el backend esté levantado (cd server && npm run dev)');
    }
    process.exit(1);
  }
})();
