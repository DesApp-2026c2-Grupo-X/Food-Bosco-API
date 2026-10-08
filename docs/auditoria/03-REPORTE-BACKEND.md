# REPORTE BACKEND — Food-Bosco-API

> **Estado:** HISTÓRICO — hallazgos de auditoría de solo lectura (2026-10-06). Correcciones aplicadas en [`15-INFORME-CORRECCIONES.md`](15-INFORME-CORRECCIONES.md).

Repositorio: `C:\Users\mateo\WebstormProjects\Food-Bosco-API`

## 1. Arquitectura

- Monorepo Turborepo NestJS por dominio.
- `apps/gateway` (4000) — GraphQL; resuelve llamando a los servicios por REST.
- `apps/auth` (4201), `apps/commerce` (4202), `apps/delivery` (4203) — REST.
- MongoDB única `fastfood` (misma conexión en los 3 servicios).
- Mensajería: `RabbitTransport` si `BROKER_URL`, si no `InProcessTransport`.
- Regla de oro: `controller → orchestrator (o servicio primario) → primario → repositorio → DB`.

## 2. Endpoints

- ~75 rutas REST documentadas vs ~90 implementadas.
- No documentados: `POST /v1/auth/register-rider`, `GET /v1/branches/available/products`,
  `GET /v1/reporting/overview`, `GET /v1/riders/by-user/:id`, `PATCH /v1/riders/me/vehicle`,
  `/v1/zones`, `/v1/shifts`, `POST /seed`.
- Gateway HTTP: `GET /health`, `POST /v1/uploads`, `POST /seed` (sin guard), `POST /graphql`.

### Auth Service (extracto)

POST `/v1/auth/register`, `/login`, `/register-rider`, `/refresh`, `/logout`, `/password-recovery`, `/reset-password`;
GET `/v1/users` (super_admin), `/v1/users/:id` (super_admin + internal), `/v1/me`;
PATCH `/v1/me`, `/v1/users/:id`, `/v1/users/:id/active`;
CRUD `/v1/addresses`; POST `/v1/seed` (internal); GET `/health`.

### Commerce Service (extracto)

Catálogo: `/v1/catalog/categories`, `/products` (+ `available`), `configurations`, `options`, `recipe`, `/ingredients`, `/promotions`, `/uploads`.
Sucursales: `/v1/branches` (+ `available`, `nearby`, `available/products`, `:id`, `:id/hours`, `:id/products`).
Carrito: `/v1/carts`, `/v1/carts/items`, `/v1/carts/confirm`.
Pedidos: `/v1/orders` (+ `:id`, `:id/history`, `:id/transitions`, `:id/status`, `:id/repeat`).
Stock: `/v1/stock`, `/v1/stock/adjustments`.
Reporting: `/v1/reporting/overview`, `/products/best-sellers|least-sold|out-of-stock|highest-revenue`.
Config: `/v1/config/parameters`, `/v1/config/order-states`.

### Delivery Service (extracto)

`/v1/riders/me` (+ `vehicle`, `availability`, `location`), `/v1/riders/by-user/:id`,
`/v1/trips/offers` (+ accept/reject), `/v1/trips` (+ `:id`, orders pickup/deliver),
`/v1/zones`, `/v1/shifts`, `/v1/seed`, `/v1/health`.

## 3. Controllers / Services / Models

- **Controllers:** no acceden a repositorios (correcto).
- **Orchestrators:** coordinan servicios primarios. Excepciones: `OrderOrchestrator` llama a `CartOrchestrator`; `OfferOrchestrator` llama a `RiderOrchestrator`.
- **Modelos por servicio (MongoDB `fastfood`):**
  - auth: `users`, `addresses`, `refreshTokens`, `passwordRecovery`.
  - commerce: `categories`, `products` (config embebida + recipe + optionAdjustments), `ingredients`, `promotions`, `branches` (hours embebidos), `branchProductAvailability`, `carts`, `orders`, `branchStock`, `stockMovements`, `parameters`, `orderStates`.
  - delivery: `riders`, `trips`, `deliveryOrders`, `zones`, `shifts`.

## 4. Auth / Roles / Permissions

- JWT HS256 firmado en auth (`{sub,userId,roles:[role],branchId}`), TTL 15m; refresh opaco (7d, rotado, revocable).
- `RolesGuard` global en auth/commerce/delivery; gateway aplica `AuthGuard` por resolver.
- `@Internal()` con `x-internal-token` (default `dev-internal-token`) bypassa RBAC.
- Roles: `customer`, `branch_admin`, `super_admin`, `rider`.
- **Defensa en profundidad real:** los servicios verifican el JWT y no confían en headers de contexto.
- Scope: `assertBranchAccess`, `assertCanView`, ownership de rider.

## 5. Lógica de negocio (verificada)

| Capacidad                                                                                                                                                        | Estado                               | Evidencia                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------- |
| Confirmar pedido: valida carrito, sucursal activa/abierta más cercana `MAX_DISTANCE_KM`, disponibilidad por sucursal, stock de ingredientes, total, ETA, PENDING | Implementado                         | `order/orchestrator.ts:47`        |
| Descuento de stock solo al pasar a `PREPARING`                                                                                                                   | Implementado                         | `order/orchestrator.ts:106`       |
| Cancelar antes de PREPARING no descuenta                                                                                                                         | Implementado                         | `order/orchestrator.ts:107`       |
| Máquina de transiciones fija en código                                                                                                                           | Implementado                         | `config/constants.ts`             |
| Reportes (más/menos vendidos, sin stock, facturación)                                                                                                            | Implementado                         | `reporting.service.ts`            |
| Ofertas de viaje (roster/rotación)                                                                                                                               | Implementado pero depende del broker | `offer/orchestrator.ts`           |
| Promociones                                                                                                                                                      | CRUD solo, sin motor de descuentos   | `promotion.service.ts`            |
| RQ-AUTH-13 validar sucursal al crear staff                                                                                                                       | NO implementado                      | `auth/config/env.ts:37` (sin uso) |

## 6. Faltantes vs documentación

- RQ-AUTH-13 (validación de sucursal contra Commerce).
- `TripOrder.order` resolver.
- OpenAPI/`packages/contracts` (RQ-REST-01/02/03, RQ-GW-03).
- Idempotencia de eventos (RQ-COM-05).
- DataLoader batch real (RQ-GW-09).
- UUID en recursos (RQ-REST-06).

## 7. Endpoints/resolvers sin consumidor frontend

GraphQL: `user`, `address`, `category`, `ingredient`, `promotion(s)`, `branchHours`, `orderHistory`,
`orderStates`+CRUD, `repeatOrder`, `setProductRecipe`, `trip`, `createRider`.
REST sin exponer: `/v1/carts/confirm`, `/v1/shifts`, `/v1/zones`, `/v1/seed`.

## 8. Features implementadas pero inalcanzables

`zones`, `shifts`, `deliveryOrders` (roster/rotación): registradas y sembradas, sin resolver GraphQL ni consumidor FE.
`StockMovement`: modelo + tipo GraphQL, sin query.

## 9. Tests

- 142 `.spec.ts` unitarios + 16 `.e2e-spec.ts` (gateway 12, commerce 2, auth 1, delivery 1).
- Falta spec del filtro de excepciones de commerce.

## 10. Riesgos

Ver `09-SEGURIDAD.md` (S1–S7) y `13-ARQUITECTURA-CALIDAD.md` (A1–A9, C1–C9).
