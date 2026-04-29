# ATU GPS Forwarder

Relay de posiciones GPS hacia el WebSocket de pruebas de ATU.

## Qué hace

- Lee posiciones desde MySQL/Traccar
- Normaliza datos GPS
- Construye payload ATU
- Valida reglas ATU
- Envía tramas por WebSocket
- Expone panel React/Vite
- Publica health, status, reports y GPS routes

## Requisitos

- Node.js 20+
- MySQL con acceso a `traccar`
- `.env` en raíz del proyecto

## Configuración

1. Copia el ejemplo:

```bash
cp .env.example .env
```

2. Completa:

- `ATU_WS_ENDPOINT=ws://devrecepcion.atu.gob.pe:5000/ws`
- `ATU_TOKEN=...`
- `MYSQL_HOST=161.132.49.33`
- `MYSQL_USER=datatransgps1985`
- `MYSQL_PASSWORD=...`
- `MYSQL_DATABASE=traccar`
- `ROUTE_ID=08`

3. Protege el archivo:

```bash
chmod 600 .env
```

## Ejecutar backend

```bash
cd server
npm install
npm run build
npm start
```

Atajo local:

```bash
cd ..
./run.sh
```

## Ejecutar frontend

```bash
cd panel
npm install
npm run dev
```

## Tests

Backend:

```bash
cd server
npm test
```

Integración WebSocket local:

```bash
cd server
npm run test:integration
```

## Verificación real

Flujo ya validado en esta sesión:

- MySQL real responde
- query GPS real devuelve filas
- payload ATU pasa validación

ATU WS real:

- endpoint esperado: `ws://devrecepcion.atu.gob.pe:5000/ws?token=TOKEN_DE_EMPRESA`
- si el endpoint devuelve `ECONNREFUSED`, el problema es de red/servicio remoto

## Restricciones operativas

- Usuario maneja DDL
- Agente usa solo `SELECT` en base de datos
- No subir `.env` al repo
