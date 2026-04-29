## Exploration: ATU GPS Forwarder / Relay Module

### Current State

The working directory `/home/senpai/atu` is completely empty — a true greenfield. However, Engram contains a **fully completed SDD cycle** for a prior change (`atu-gps-websocket`) that built a Python async bridge (Traccar → ATU SICM). That service was implemented, tested (17 tests passed), and even run against the **real** ATU test endpoint (`ws://devrecepcion.atu.gob.pe:5000/ws`).

Critical production learnings from the prior cycle:
- ATU endpoint is **plaintext ws:// on port 5000** (not wss://).
- ATU response schema **does not match the manual**: real fields are `codigo`, `descrip`, `identifier`, `timestamp` (string), plus undocumented codes `16` and `17`.
- **Code 07** (`placa inválida`) rejected **100% of payloads** from the "La Ocho" fleet, suggesting plates or `route_id` were not pre-registered in ATU SICM.
- `driver_id` is **not available** in the Traccar instance used (`/api/drivers` returned empty).
- Traccar speed is in **knots**; ATU expects **km/h** (×1.852).
- IMEI must be serialized as a **string** (15 digits), despite the manual listing it as a number.
- Many Traccar timestamps were stale (>10 min), triggering the retransmission queue logic immediately.

This new change (`atu-gps-forwarder`) appears to be an **enterprise-grade expansion or rewrite** targeting the same ATU contract but with a Node.js/TypeScript stack, a formal multi-source adapter architecture, and operational components (health checks, alerts, mock server, Docker Compose).

### Affected Areas

Since the directory is empty, **all files are new**. The architecture requested by the user maps to the following logical modules:

| Component | Responsibility | NestJS Mapping |
|-----------|---------------|----------------|
| GPS Source Adapter | Abstract multiple ingress sources (DB, API, webhook, queue, file, socket) | `@Injectable()` adapter strategy pattern |
| GPS Data Normalizer | Convert raw source data into a canonical internal model | Service + DTO mappers |
| ATU Payload Mapper | Canonical model → ATU 11-field JSON | Service |
| ATU Payload Validator | Strict validation per ATU manual + discovered rules | `class-validator` + custom pipes |
| Transmission Scheduler | Enforce ≤20 s interval per active vehicle | `@nestjs/schedule` (BullMQ if distributed) |
| ATU WebSocket Client | Connect, send, heartbeat, reconnect to ATU WS | `ws` library wrapped in a provider |
| ATU Response Handler | Parse `codigo`, stop on `03`, log others | Service |
| Transmission Log Repository | Persist every transmission attempt + response | Prisma + PostgreSQL repository |
| Retry Manager | Retry only technical errors (disconnect, timeout), never validation | Service with exponential backoff |
| Alert Manager | Notify on persistent failures, code 03, stale data spikes | Service (webhook/email/Slack) |
| Configuration Manager | Two-phase config (test/production), token management | `@nestjs/config` + validation schema |
| Health Check Service | Endpoints for service, DB, ATU WS connectivity | `@nestjs/terminus` |
| Mock ATU WebSocket Server | Local testing server mimicking real ATU responses | `ws` + small Express/NestJS gateway |

### Approaches

1. **NestJS (Recommended)** — Full-featured enterprise framework
   - **Pros**: Built-in DI, WebSocket gateway support, `@nestjs/schedule`, `@nestjs/config`, `class-validator`, excellent modular architecture matching the 13 requested components. Strong testing utilities (`Test` module). Large ecosystem for Prisma/BullMQ/PostgreSQL.
   - **Cons**: Heavier boilerplate than raw Express. Some magic can obscure WebSocket lifecycle if not careful.
   - **Effort**: Medium — initial scaffolding is verbose, but velocity increases sharply as modules grow.

2. **Express + raw `ws` + node-cron** — Minimalist, explicit control
   - **Pros**: Lighter bundle, zero framework magic, easier to debug WebSocket frames directly.
   - **Cons**: No built-in DI means manual wiring for 13 components. No standard project structure — teams often invent incompatible patterns. Validation, scheduling, and config management become bespoke.
   - **Effort**: High — you end up rebuilding what NestJS gives for free.

3. **Fastify + `ws` + BullMQ** — Performance-first
   - **Pros**: Lower overhead than Express, great for high-frequency ingestion if the GPS source is a high-volume message queue.
   - **Cons**: Smaller community for the exact stack. NestJS can run on Fastify if raw speed becomes a bottleneck later.
   - **Effort**: Medium-High — less documentation for the specific integration patterns needed.

### Recommendation

**Adopt NestJS** with the following sub-choices:
- **Runtime**: Node.js 20+ LTS (stable, native `fetch`, good `ws` performance).
- **WS Library**: `ws` (via a custom provider or `@nestjs/websockets` adapter) because ATU uses a raw query-string token (`?token=...`) and non-standard response fields that may not fit Socket.io semantics cleanly.
- **Validation**: `class-validator` + `class-transformer` (standard NestJS stack) — models already defined in requirements.
- **Scheduler**: `@nestjs/schedule` (Cron) for the 20-s heartbeat per vehicle; escalate to **BullMQ** only if fleet size >~500 vehicles and you need distributed job processing across containers.
- **Database**: **PostgreSQL** with **Prisma** (type-safe, excellent migration story, built-in connection pooling).
- **Testing**: Jest (NestJS default) + `jest-websocket-mock` or a lightweight `ws` mock server for the ATU client.
- **Containerization**: Docker Compose with services: `app`, `postgres`, `redis` (for BullMQ if used), `mock-atu-ws`.

**Rationale**: The user's requirement is explicitly a **13-component modular architecture**. NestJS modules/providers map 1-to-1 to these components, enforcing clean boundaries. The previous Python project proved the ATU contract works; this rewrite should focus on **operational robustness**, which NestJS excels at.

### Risks

- **ATU Registration Mismatch (HIGH)**: The prior project hit code 07 (`placa inválida`) on 100% of payloads. Until ATU confirms the exact `license_plate` + `route_id` + `imei` whitelist for the company, any forwarder will fail silently in production.
- **Missing `driver_id` (MEDIUM)**: Traccar (the likely source) had no driver data. If ATU requires this field, we need an external mapping table or a default value strategy.
- **Response Format Drift (MEDIUM)**: ATU already deviated from its own manual (string timestamps, `codigo` vs `code`, new codes 16/17). More drift is likely.
- **Stale Data Flood (MEDIUM)**: Traccar timestamps were frequently >10 min old. The retransmission endpoint is still undefined by ATU; a large queue could accumulate rapidly.
- **ws:// Plaintext (LOW-MEDIUM)**: Port 5000 plaintext may be blocked by corporate egress firewalls in production. The production endpoint must be clarified.
- **20-second Interval at Scale (LOW)**: With a large fleet, maintaining a 20-s schedule per vehicle can create thousands of concurrent timers. BullMQ may become necessary sooner than expected.

### Ready for Proposal

**No** — two blockers must be resolved first:

1. **GPS Source Clarification**: Is the source still Traccar (reusing the previous OpenAPI spec), or is it a different system (DB, generic API, message queue)? This determines the Adapter interface.
2. **ATU Registration Alignment**: We need confirmation from ATU (or the user) about valid `license_plate`, `route_id`, and `imei` values, plus whether `driver_id` can be omitted or defaulted.

Once these are answered, the next phase should be **`sdd-propose`** (scope definition) followed immediately by **`sdd-spec`** because the requirements are already quite detailed.
