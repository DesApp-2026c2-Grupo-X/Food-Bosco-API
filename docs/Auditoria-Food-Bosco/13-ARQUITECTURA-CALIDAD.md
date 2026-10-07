# ARQUITECTURA Y CALIDAD — Food-Bosco

Severidad: **C**=Crítica(correctitud/pérdida de datos), **A**=Alta, **M**=Media, **B**=Baja.

## 1. Arquitectura (priorizado)

### A1 — [A] El DataLoader no resuelve el N+1

`apps/gateway/src/graphql/commerce/commerce.dataloaders.ts:22-32` hace `Promise.all(keys.map(id => rest.get(...)))` → un HTTP GET por id. Agrupa en microtask pero no reduce requests. Además `commerce.fields.resolver.ts:124-137` (`riderLocation`) llama a Delivery por cada Order.
**Recomendación:** endpoints batch (`?ids=a,b,c` o POST batch) o documentar que solo deduplica.

### A2 — [A] El fallback in-process del bus rompe la comunicación entre servicios

`apps/*/src/config/messaging/messaging.module.ts:12`: `brokerUrl ? Rabbit : InProcess`. Con `BROKER_URL=` (default `.env.example`) cada app tiene su propio `EventEmitter`; `trip.accepted`/`order.status_changed` nunca cruzan de proceso. Además `rabbit.transport.ts:52` usa `noAck:true` y `void handler(event)` (sin retry/DLQ).
**Recomendación:** obligar `BROKER_URL` fuera de test; ack tras procesar; retry+DLQ.

### A3 — [A] No existe el paquete de contratos/OpenAPI que exige la doc

Sin `packages/contracts`, sin `openapi.yaml`, sin codegen. Gateway y FE escriben paths/mappers a mano (`rest.client.ts`, `graphql/common/mappers.ts`, `packages/api/src/client/*`).
**Recomendación:** crear `packages/contracts` + codegen, o actualizar la doc.

### A4 — [A] Base de datos compartida `fastfood` entre servicios

Los 3 servicios usan la misma DB (default `mongodb://localhost:27017/fastfood`). `reporting.repository.ts:6-10` inyecta modelos de otros dominios.
**Recomendación:** DB (o namespace/usuario) por servicio; reporting vía read-model.

### A5 — [A] Violación de la regla de oro

`apps/commerce/src/branch/branch.service.ts:22` inyecta `ParameterService` (dos servicios primarios cooperando). Debe coordinarlos un orchestrator.
**Recomendación:** mover la cooperación a `BranchOrchestrator`/`OrderOrchestrator`.

### A6 — [M] Orchestrator llama a Orchestrator

`order.orchestrator.ts:39` (`CartOrchestrator`), `offer.orchestrator.ts:37` (`RiderOrchestrator`).
**Recomendación:** un único dueño del caso de uso.

### A7 — [M] El gateway contiene orquestación y no valida input

`seed.controller.ts` ordena commerce→auth→delivery (RQ-GW-12 "sin lógica"); `main.ts:8` sin `ValidationPipe` ni `class-validator`.
**Recomendación:** mover seed fuera; añadir `APP_PIPE` + validación.

### A8 — [M] Enums/contratos duplicados (3 representaciones)

FE (UPPER) / GraphQL (UPPER) / REST-DB (lower) sin fuente única.
**Recomendación:** contrato compartido o test de paridad.

### A9 — [M] Deriva de documentación entre repos

`requerimientos-backend-rest.md` difiere entre FE y API (la de API agrega RQ-GW-14 y RQ-CAT-17). `README`/`CLAUDE.md` desactualizados (SWR, puertos, gateway).
**Recomendación:** una copia canónica.

## 2. Calidad / config / contratos

| #   | Hallazgo                                              | Sev | Evidencia                                        |
| --- | ----------------------------------------------------- | --- | ------------------------------------------------ |
| C1  | Secreto commiteado (Geoapify)                         | M   | `apps/store/.env.native:3`                       |
| C2  | JWT sin pinning de algoritmo                          | M   | `*/security/jwt.service.ts`                      |
| C3  | Idempotencia de eventos parcial                       | M   | `trip-events.consumer.ts`, `rabbit.transport.ts` |
| C4  | Mapeo de errores FE por regex de mensaje              | M   | `packages/auth/src/utils/authErrors.ts:32-51`    |
| C5  | Dependencia muerta `swr`                              | B   | `apps/*/package.json`                            |
| C6  | Proxy `/api` muerto + default inconsistente           | B   | `apps/branch/vite.config.ts:6`                   |
| C7  | CORS permisivo; error formatter descarta `httpStatus` | B   | `main.ts`, `graphql-error-formatter.ts:16`       |
| C8  | Mappers duplicados (`toUser` en 2 sitios)             | B   | `mappers.ts:46`, `operations.ts:85`              |
| C9  | Tests: BE 142 unit + 16 e2e; FE 45 sin e2e            | B   | conteos                                          |

## 3. Lo que está BIEN (no es problema)

- Chakra-only, sin `div` crudos; layouts con `<Outlet/>`; named exports.
- Cadena de password es composición deliberada.
- Sin `fetch` directo en apps; todo por `@repo/api`.
- Dos vistas de detalle de pedido: casos de uso distintos (no duplicación real).
- Controllers no tocan repositorios; seeds idempotentes.

## 4. Prioridad sugerida

A1, A2, A3, A5 (correctitud/contrato) → A4, C1, C2 → resto.
