# Plan — Rider / Delivery (Delivery Service + API Gateway)

> Plan de implementación del backend del Repartidor: **Delivery Service** (`apps/delivery`, puerto `4203`) y la extensión del **API Gateway** (`apps/gateway`, puerto `4000`) con el dominio GraphQL de Delivery.

**Fecha:** 2026-08-20

**Fuentes de verdad:**

- `../requerimientos-backend-rest.md` §3, §4, §8, §9, §10, §11.3, §12, §13, §15
- `../requerimientos-frontend.md` §1.3, §1.4, §11, §12 (Repartidor)
- `../fundamentacion-gateway-graphql-rest.md` (frontera GraphQL/REST)
- `.claude/skills/orchestrator-domain-architecture` (estructura por dominio, regla de oro)
- `.claude/skills/domain-patterns` (ETA, máquinas de estado, snapshots)
- `../auth/plan.md` (patrón de referencia de la implementación de Auth)

---

## 0. Objetivo del plan

Entregar **de punta a punta** el backend del Repartidor para que la app `apps/rider`
pueda consumirlo a través del gateway:

1. **Delivery Service** (`../../apps/delivery`, puerto `4203`) — implementación completa
   (repartidores, disponibilidad/ubicación, ofertas de viaje, viajes, retiros y entregas).
2. **API Gateway** (`../../apps/gateway`, puerto `4000`) — extensión del esquema GraphQL
   con el dominio `delivery` (tipos, queries y mutations) traduciendo a REST contra el
   Delivery Service.

El gateway ya tiene la infraestructura transversal lista (JWT/RBAC, rate limiting,
`RestClient`, `DataLoader`, formateo de errores, health, `requestId`) y el
`DELIVERY_REST_CLIENT` ya declarado. La extensión consiste en **definir el esquema
GraphQL del dominio delivery y sus resolvers**, reutilizando esa infraestructura.

---

# PARTE 1 — Análisis y decisiones

## 1.1 Estado actual (verificado en el repo)

| App / paquete    | Estado real                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/auth`      | **Implementado por completo** (dominio por dominio, Mongo, JWT/RBAC, direcciones, recuperación, seed). Ya crea riders (`POST /v1/users/riders`, `POST /v1/auth/register-rider`) y guarda `vehicle` en `users`.                                                                                               |
| `apps/gateway`   | Infraestructura transversal lista + **solo el dominio GraphQL `auth`**. Ya tiene `DELIVERY_REST_CLIENT`, `DataLoader`, `RestClient`, `@Roles`/`@Authenticated`, throttle, health, `requestId`. En `graphql/common` ya existen `TripStatus`, `GeoPoint`, `OrderStatus`, `ConfigGroupType`, `mappers`, `page`. |
| `apps/commerce`  | **Template NestJS vacío** (app.controller/service + main en 4202). Sin dominios.                                                                                                                                                                                                                             |
| `apps/delivery`  | **Template NestJS vacío** (app.controller/service + main en 4203). Sin dominios.                                                                                                                                                                                                                             |
| `packages/`      | Solo `eslint-config` y `typescript-config`. **No existe** `packages/contracts/openapi`.                                                                                                                                                                                                                      |
| Broker / eventos | **No existe** ninguna abstracción de mensajería (RabbitMQ/Kafka) ni `docker-compose`.                                                                                                                                                                                                                        |

Conclusión: hay que **construir Delivery desde cero** (igual que se hizo con auth),
**extender el gateway** con el dominio GraphQL `delivery`, y **crear la capa de eventos**
que el backend exige para Commerce↔Delivery. Commerce es una **dependencia parcial**:
solo se necesita una superficie mínima de él para que Delivery funcione de punta a punta
(ver §1.4 y Parte 7).

## 1.2 Requerimientos explícitos de backend

Fuente: `requerimientos-backend-rest.md` §8, §9, §10, §11.3, §15.

### Endpoints REST del Delivery Service (`/v1`)

| Método | Ruta                                          | Acceso  | Requerimiento       |
| ------ | --------------------------------------------- | ------- | ------------------- |
| GET    | `/v1/riders/me`                               | `rider` | RQ-DLV-11           |
| PATCH  | `/v1/riders/me`                               | `rider` | RQ-DLV-11           |
| PATCH  | `/v1/riders/me/availability`                  | `rider` | RQ-DLV-01           |
| PATCH  | `/v1/riders/me/location`                      | `rider` | RQ-DLV-02           |
| GET    | `/v1/trips/offers`                            | `rider` | RQ-DLV-03           |
| POST   | `/v1/trips/offers/{offerId}/accept`           | `rider` | RQ-DLV-05/06        |
| POST   | `/v1/trips/offers/{offerId}/reject`           | `rider` | RQ-DLV-05           |
| GET    | `/v1/trips`                                   | `rider` | RQ-DLV-10           |
| GET    | `/v1/trips/{tripId}`                          | `rider` | RQ-DLV-07/10        |
| POST   | `/v1/trips/{tripId}/orders/{orderId}/pickup`  | `rider` | RQ-DLV-07           |
| POST   | `/v1/trips/{tripId}/orders/{orderId}/deliver` | `rider` | RQ-DLV-07/08        |
| GET    | `/health`                                     | público | RQ-REST-04 / NFR-08 |

### Eventos (RQ-COM-03/04/05, §9)

- Consume `order.status_changed` (de Commerce) → genera ofertas cuando la orden pasa a
  `READY_FOR_DELIVERY`.
- Emite `trip.accepted` y `trip.completed` (→ Commerce marca órdenes asignadas / cierra
  viaje y entrega).

### Seguridad (RQ-SEC-04/06)

- Re-validación del JWT en Delivery (defensa en profundidad).
- El `rider` solo opera sus propios viajes.

### Colecciones (§11.3)

- `riders`, `trips` (+ ajustes, ver §1.3).

## 1.3 Requerimientos inferidos

Emergen de las pantallas R-01…R-05 y §1.3/§1.4 del frontend; no están documentados
explícitamente en el backend:

| #   | Requerimiento inferido                                                                                                                                                                                                   | Origen             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 1   | **Onboarding del rider (sync Auth→Delivery):** al crearse un usuario `rider` en Auth, Delivery debe tener un documento en `riders`. No está documentado cómo se sincroniza.                                              | R-05 + §1.3        |
| 2   | **Nombre del repartidor:** `GET /v1/riders/me` debe devolver _nombre, vehículo, teléfono_ (§8), pero el nombre vive en Auth `users`.                                                                                     | §8 + R-05          |
| 3   | **Pool persistente de órdenes `READY_FOR_DELIVERY`:** RQ-DLV-03 dice "a partir de los pedidos notificados". Delivery (stateless, NFR-02) necesita persistir las órdenes listas entre el evento y la creación del viaje.  | RQ-DLV-03 + NFR-02 |
| 4   | **Vencimiento de ofertas (countdown):** R-01 muestra "⏱ 0:28" y RQ-DLV-05 "si no responde, la oferta vence".                                                                                                             | R-01 + RQ-DLV-05   |
| 5   | **Cálculo de distancia, tiempo y ganancia de la oferta:** `TripOffer` exige `distanceKm`, `estimatedMinutes`, `estimatedEarnings`.                                                                                       | §4 (TripOffer)     |
| 6   | **Quién transiciona la orden a `ON_THE_WAY` / `DELIVERED`:** el repartidor marca retiro/entrega (Delivery), pero la máquina de estados de la orden vive en Commerce (`READY_FOR_DELIVERY → ON_THE_WAY → DELIVERED`).     | R-02 + RQ-ORD      |
| 7   | **Ruta retiro → entrega (mapa multi-parada):** el viaje debe exponer por orden la sucursal de retiro (coords) y la dirección de entrega (coords). El detalle (R-03) requiere `TripOrder.order` resuelto contra Commerce. | R-02/R-03          |
| 8   | **Ganancias reales del viaje (`earnings`):** `Trip` lleva `earnings`; R-04 lo muestra en el historial.                                                                                                                   | §4 (Trip) + R-04   |
| 9   | **`tripId`/`riderId` en la orden (asignación):** `trip.accepted` → Commerce "marca órdenes como asignadas"; sin estado nuevo, implica un campo de asignación en la orden.                                                | §9                 |

## 1.4 Decisiones de diseño

| #   | Tema                                 | Recomendación                                                                                                                                                                                                                    | Alternativa                                                                     |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | Onboarding rider                     | **Lazy upsert idempotente**: al primer `GET /v1/riders/me`, un `RiderOrchestrator` crea el doc en `riders` (tomando `firstName/lastName/vehicle/phone` de Auth vía `GET /v1/users/{userId}` con `X-Internal-Token`). Sin broker. | Evento `user.created` (necesita broker ya).                                     |
| D2  | Nombre del rider                     | **Snapshot en `riders`** (firstName/lastName) al onboarding; `riderProfile` devuelve todo.                                                                                                                                       | Resolver `Rider.user` en gateway (DataLoader a Auth).                           |
| D3  | Pool de órdenes listas               | **Nueva colección `deliveryOrders`** (idempotente por `orderId`), alimentada por `order.status_changed`.                                                                                                                         | Consultar Commerce `GET /v1/orders?status=READY_FOR_DELIVERY` en vivo.          |
| D4  | Transición de orden (retiro/entrega) | **Orchestrator de Delivery llama a Commerce REST** (`PATCH /v1/orders/{orderId}/status`) — permitido por RQ-COM-07 (orchestrator, no servicio primario). Emite además `trip.accepted`/`trip.completed`.                          | Eventos `order.picked_up`/`order.delivered` (agrega eventos no listados en §9). |
| D5  | Parámetros de oferta (economics)     | **En `config/env.ts` de Delivery** con defaults: `OFFER_TTL_SECONDS`, `EARNINGS_BASE`, `EARNINGS_PER_KM`, `EARNINGS_PER_ORDER`, `MAX_MATCH_DISTANCE_KM`, `AVG_SPEED_KMH`, `MAX_ORDERS_PER_TRIP`.                                 | Colección `parameters` propia en Delivery o leer de Commerce.                   |
| D6  | Broker                               | **RabbitMQ** local (docker-compose) + abstracción ligera por servicio (`config/messaging`).                                                                                                                                      | Kafka / NATS. (Cualquiera sirve; la abstracción aísla el transporte.)           |
| D7  | Contratos OpenAPI                    | Seguir el patrón real (RestClient + tipos "raw" a mano, como hizo auth) ahora; **añadir** `packages/contracts/openapi/delivery/delivery.openapi.yaml` como documentación de contrato.                                            | Bloquear en codegen OpenAPI (no existe hoy; costoso).                           |
| D8  | `TripOrder.order` en gateway         | Depende de Commerce (tipo `Order` GraphQL aún no existe). **Implementar `TripOrder` con sus campos inline ahora** y exponer `order` nullable/deferido hasta la fase Commerce.                                                    | Construir un tipo `Order` mínimo ya.                                            |

---

# PARTE 2 — Delivery Service

## 2.1 Alcance

Implementar el **Delivery Service** completo (puerto `4203`), dueño de los repartidores,
su disponibilidad/ubicación, las ofertas de viaje y los viajes (retiros y entregas).
Expone API REST bajo `/v1`.

Se cubren los requerimientos `RQ-DLV-01` a `RQ-DLV-13`, más los transversales
`RQ-SEC-04/06`, `RQ-COM-03/04/05`, `RQ-REST-04/07`, `NFR-01/02/04/05/08`.

**Queda fuera de esta tarea:**

- Commerce Service (ver Parte 7 para su superficie mínima requerida).
- El dominio GraphQL de Commerce en el gateway (solo se consume vía `TripOrder.order`).

## 2.2 Decisiones técnicas

| Tema            | Decisión                                                                                         | Motivo                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| ODM             | `@nestjs/mongoose` + `mongoose`                                                                  | Estándar NestJS + MongoDB, igual que `apps/auth`.                                        |
| JWT             | `jsonwebtoken` (crudo, como auth/gateway)                                                        | Secreto compartido (`JWT_SECRET`); consistencia con el resto.                            |
| Validación      | `class-validator` + `class-transformer` con `ValidationPipe` global                              | Validación de DTOs declarativa.                                                          |
| Config          | módulo `config/env.ts`                                                                           | Sin `@nestjs/config`; se lee `process.env` con defaults de desarrollo.                   |
| RBAC            | `RolesGuard` que verifica la firma del JWT + `@Roles(rider)` + `@Authenticated` + `@CurrentUser` | Copia del patrón de `apps/auth`.                                                         |
| Broker          | RabbitMQ (`amqplib`) detrás de una abstracción `config/messaging`                                | Eventos cross-service (§9), idempotentes.                                                |
| HTTP a Commerce | `fetch` nativo de Node 20                                                                        | Cliente `config/http/commerce.client.ts` (transición de orden, lectura de branch/order). |
| Geo             | Haversine propio en `config/geo/distance.ts`                                                     | Sin dependencia; consistente con el patrón de Commerce (asignación por distancia).       |
| IDs             | `ObjectId` de Mongoose                                                                           | Consistencia con `apps/auth`.                                                            |

**Dependencias nuevas en `apps/delivery/package.json`:**

- `@nestjs/mongoose`, `mongoose`
- `jsonwebtoken` (+ `@types/jsonwebtoken` en dev)
- `class-validator`, `class-transformer`
- `amqplib` (+ `@types/amqplib` en dev)

## 2.3 Variables de entorno (las carga el usuario)

| Variable                | Default (dev)                        | Uso                                                               |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `PORT`                  | `4203`                               | Puerto HTTP.                                                      |
| `MONGODB_URI`           | `mongodb://localhost:27017/fastfood` | Conexión a MongoDB.                                               |
| `JWT_SECRET`            | `dev-secret-change-me`               | Secreto compartido con el gateway.                                |
| `COMMERCE_SERVICE_URL`  | `http://localhost:4202`              | Cliente REST a Commerce.                                          |
| `INTERNAL_API_TOKEN`    | `dev-internal-token`                 | Token para leer `GET /v1/users/{userId}` (Auth) en el onboarding. |
| `BROKER_URL`            | `amqp://localhost:5672`              | Broker de eventos (RabbitMQ).                                     |
| `OFFER_TTL_SECONDS`     | `30`                                 | Vida de una oferta antes de vencer (countdown R-01).              |
| `EARNINGS_BASE`         | `500`                                | Ganancia base por viaje (moneda del proyecto).                    |
| `EARNINGS_PER_KM`       | `200`                                | Ganancia por kilómetro.                                           |
| `EARNINGS_PER_ORDER`    | `300`                                | Ganancia por orden agrupada.                                      |
| `MAX_MATCH_DISTANCE_KM` | `8`                                  | Radio de matching de órdenes listas.                              |
| `AVG_SPEED_KMH`         | `25`                                 | Velocidad promedio para estimar minutos.                          |
| `MAX_ORDERS_PER_TRIP`   | `3`                                  | Máximo de órdenes por viaje.                                      |

Se documentará en `apps/delivery/.env.example` (no se versiona `.env`). Se actualizará
`turbo.json` (`globalEnv`) con las variables nuevas.

## 2.4 Estructura por dominio

Sigue la skill `orchestrator-domain-architecture` (dominio → `controller` →
`orchestrator`/`servicio primario` → `repository` → BD), espejo de `apps/auth`.

```text
apps/delivery/src/
├── main.ts                       # bootstrap + ValidationPipe global + HttpExceptionFilter + prefijo /v1
├── app.module.ts                 # Database + Security + Health + dominios + messaging + RequestIdMiddleware
├── config/
│   ├── env.ts                    # env centralizado (PORT, MONGODB_URI, JWT_SECRET, COMMERCE_SERVICE_URL, params de oferta)
│   ├── constants.ts              # ROLES, ERROR_CODES, HEADERS, TRIP_STATUS (offered|active|completed|cancelled)
│   ├── database/
│   │   └── database.module.ts    # MongooseModule.forRoot(env.mongoUri)
│   ├── security/
│   │   ├── jwt.service.ts        # verify access token → AuthContext
│   │   ├── roles.decorator.ts    # @Roles(...)
│   │   ├── roles.guard.ts        # verifica JWT + RBAC, puebla request.user
│   │   ├── authenticated.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── security.module.ts
│   ├── exceptions/
│   │   ├── domain.exception.ts
│   │   └── http-exception.filter.ts   # envelope { code, message, path } (RFC 7807)
│   ├── http/
│   │   └── commerce.client.ts    # GET /v1/branches/{id}, GET /v1/orders/{id}, PATCH /v1/orders/{id}/status
│   ├── messaging/
│   │   ├── event-bus.ts          # connect/publish/subscribe (RabbitMQ)
│   │   ├── events.ts             # esquemas versionados de eventos
│   │   └── order-events.consumer.ts  # consume order.status_changed (idempotente)
│   ├── geo/
│   │   └── distance.ts           # haversineDistance + estimateMinutes
│   └── observability/
│       └── request-id.middleware.ts
├── health/
│   ├── health.controller.ts      # GET /health
│   └── health.module.ts
├── rider/                        # DOMINIO DE NEGOCIO
│   ├── rider.model.ts            # collection `riders`
│   ├── rider.repository.ts
│   ├── rider.service.ts          # perfil, disponibilidad, ubicación
│   ├── rider.orchestrator.ts     # onboarding lazy (D1)
│   ├── rider.controller.ts       # GET/PATCH /v1/riders/me · /availability · /location
│   ├── rider.module.ts
│   └── dto/
│       ├── update-rider-profile.dto.ts
│       ├── availability.dto.ts
│       └── location.dto.ts
├── delivery-order/               # DOMINIO DE NEGOCIO — pool de órdenes listas
│   ├── delivery-order.model.ts   # collection `deliveryOrders`
│   ├── delivery-order.repository.ts
│   ├── delivery-order.service.ts # upsert idempotente, listar disponibles, reservar/liberar
│   └── delivery-order.module.ts
├── trip/                         # DOMINIO DE NEGOCIO
│   ├── trip.model.ts             # collection `trips`
│   ├── trip.repository.ts
│   ├── trip.service.ts           # CRUD + máquina de estados del viaje + pickup/deliver
│   ├── trip.controller.ts        # GET /v1/trips · GET /v1/trips/{id} · POST .../pickup · .../deliver
│   ├── trip.module.ts
│   └── dto/
└── offer/                        # DOMINIO DE ORQUESTACIÓN
    ├── offer.controller.ts       # GET /v1/trips/offers · POST .../accept · .../reject
    ├── offer.orchestrator.ts     # matching + distancia/tiempo/ganancia + creación de viaje offered + expiración
    ├── offer.module.ts
    └── dto/
```

**Se eliminarán** `app.controller.ts`, `app.service.ts` y `app.controller.spec.ts`
(reemplazados por los dominios); `test/app.e2e-spec.ts` se reemplaza.

Regla de oro respetada: ningún servicio primario importa a otro servicio primario. Las
coordinaciones viven en `rider.orchestrator.ts` y `offer.orchestrator.ts`.

## 2.5 Modelos de datos (MongoDB — colecciones de Delivery Service)

Base `fastfood`. Colecciones según §11.3, con los ajustes de §1.3.

### `riders`

```text
{
  _id: ObjectId,
  userId: string (unique index),        # referencia a Auth users
  firstName: string,                    # snapshot (D2)
  lastName: string,                     # snapshot (D2)
  vehicle: string,
  phone: string,
  available: boolean (default false),
  status: 'offline' | 'free' | 'on_trip',
  currentLocation: { latitude, longitude } | null,
  createdAt: Date,
  updatedAt: Date
}
```

Índices: `userId` único.

### `trips`

```text
{
  _id: ObjectId,
  riderId: string,
  status: 'offered' | 'active' | 'completed' | 'cancelled',
  orders: [
    {
      orderId: string,
      pickupBranchId: string,
      pickupBranch: { name, addressText, latitude, longitude },   # snapshot
      deliveryAddress: { text, latitude, longitude },             # snapshot
      status: string,                                             # espejo del estado en Commerce
      pickedUpAt: Date | null,
      deliveredAt: Date | null
    }
  ],
  distanceKm: number,
  estimatedMinutes: number,
  estimatedEarnings: number,
  earnings: number | null,
  startedAt: Date | null,
  completedAt: Date | null,
  expiresAt: Date | null,              # solo status 'offered'
  createdAt: Date
}
```

Índices: `riderId`, `status`.

### `deliveryOrders` (pool — D3)

```text
{
  _id: ObjectId,
  orderId: string (unique index),
  branchId: string,
  branchLocation: { latitude, longitude },
  deliveryAddress: { text, latitude, longitude },
  status: string,
  createdAt: Date
}
```

Índices: `orderId` único, `status`.

## 2.6 Lógica clave por caso de uso

- **Onboarding (`RiderOrchestrator`):** `GET /v1/riders/me` → si no hay doc por `userId`,
  `GET /v1/users/{userId}` (Auth, header `X-Internal-Token`) → crea `riders` con snapshot
  de `firstName/lastName/vehicle/phone`. Idempotente.
- **Consumidor `order.status_changed`:** `READY_FOR_DELIVERY` → upsert en `deliveryOrders`;
  `CANCELLED`/`DELIVERED`/asignada → quitar del pool. Idempotente por `orderId`.
- **`GET /v1/trips/offers` (`OfferOrchestrator`):** exige `available=true` +
  `currentLocation`; toma hasta `MAX_ORDERS_PER_TRIP` órdenes del pool dentro de
  `MAX_MATCH_DISTANCE_KM`; calcula `distanceKm` (Haversine, ruta
  rider→retiros→entregas), `estimatedMinutes` (`/ AVG_SPEED_KMH`),
  `estimatedEarnings` (`EARNINGS_BASE + EARNINGS_PER_KM·dist + EARNINGS_PER_ORDER·n`);
  crea `trips{status:'offered', riderId, expiresAt: now+OFFER_TTL_SECONDS}` y reserva las
  órdenes; devuelve `TripOffer[]`.
- **`accept`:** valida vigencia → `trips.status='active'`, `startedAt=now`, libera ofertas
  duplicadas de las mismas órdenes, emite `trip.accepted`.
- **`reject` / expiración:** libera las órdenes reservadas (vuelven al pool);
  `trips.status='cancelled'`.
- **`pickup`:** valida que la orden pertenece al viaje del rider → `PATCH
/v1/orders/{orderId}/status` (Commerce) a `ON_THE_WAY` → actualiza `orders[i].status` +
  `pickedUpAt`.
- **`deliver`:** idem a `DELIVERED` → `deliveredAt`, `earnings` acumuladas; si es la última
  orden → `trips.status='completed'` + `completedAt` + emite `trip.completed`.
- **Seguridad (RQ-SEC-06):** `RolesGuard` (rider) + verificación de que
  `trip.riderId == userId` del JWT en toda mutación de viaje.

## 2.7 Eventos (esquemas versionados, RQ-COM-04)

| Evento                 | Emisor   | Consumidor | Payload mínimo                                                                                 |
| ---------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `order.status_changed` | Commerce | Delivery   | `{ version, eventId, orderId, status, branchId, branchLocation, deliveryAddress, occurredAt }` |
| `trip.accepted`        | Delivery | Commerce   | `{ version, eventId, tripId, riderId, orderIds[] }`                                            |
| `trip.completed`       | Delivery | Commerce   | `{ version, eventId, tripId, riderId, orderIds[] }`                                            |

El consumo es idempotente (RQ-COM-05): reprocesar un evento no duplica efectos
(`orderId` como clave de dedupe en el pool).

## 2.8 Seguridad

- **JWT access**: payload `{ sub, userId, roles: [rider], branchId }`; se verifica la firma
  (no se confía en headers `X-*`).
- **Guard/RBAC**: `RolesGuard` aplica `@Roles(rider)`; puebla `request.user` para
  `@CurrentUser()`.
- **Defensa en profundidad (RQ-SEC-04)**: cada endpoint protegido declara su rol.
- **Solo viajes propios (RQ-SEC-06)**: toda operación sobre un `trip` valida `riderId`.
- **Sin secretos en logs (RQ-SEC-07)**.

## 2.9 Manejo de errores

Envelope único (RQ-REST-07, NFR-05), igual que auth:

```json
{ "code": "RIDER_NOT_FOUND", "message": "Repartidor no encontrado", "path": "/v1/riders/me" }
```

Catálogo inicial: `RIDER_NOT_FOUND`, `RIDER_OFFLINE`, `LOCATION_REQUIRED`,
`OFFER_NOT_FOUND`, `OFFER_EXPIRED`, `TRIP_NOT_FOUND`, `ORDER_NOT_IN_TRIP`,
`INVALID_TRIP_STATUS`, `NO_ORDERS_AVAILABLE`, `VALIDATION_ERROR`, `FORBIDDEN`,
`UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL`.

---

# PARTE 3 — Extensión del API Gateway

## 3.1 Estado actual (qué ya existe y se reutiliza)

| Pieza                                                                               | Estado                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------- |
| `DELIVERY_REST_CLIENT` (`rest.module.ts`)                                           | listo (`env.services.delivery`, puerto 4203) |
| `RestClient` + `DataLoader`                                                         | listo                                        |
| `@Roles` / `@Authenticated` / `RolesGuard` / `AuthGuard`                            | listo                                        |
| Enums `TripStatus`, `GeoPoint`, `OrderStatus`, `ConfigGroupType` (`graphql/common`) | listos                                       |
| `mappers.ts`, `page.ts`, `rest-context.ts`                                          | listos                                       |
| JWT context (`gateway.context.ts`)                                                  | listo (expone `userId/roles/branchId`)       |

## 3.2 Estructura de archivos nuevos (gateway)

```text
apps/gateway/src/graphql/delivery/
├── delivery.types.ts    # @ObjectType Rider, TripOrder, TripOffer, Trip + mapRider/mapTrip*/...
├── delivery.inputs.ts   # @InputType UpdateRiderProfileInput { vehicle?, phone? }
├── delivery.resolver.ts # Query + Mutation del dominio delivery
└── delivery.module.ts   # importa RestModule
```

Registrar `DeliveryGraphqlModule` en `gateway/gateway.module.ts` (junto a
`AuthGraphqlModule`).

## 3.3 Esquema GraphQL a exponer (dominio delivery)

Extraído de `requerimientos-backend-rest.md` §4 (sin cambios de nombres).

```graphql
type Rider {
  id: ID!
  userId: ID!
  vehicle: String
  phone: String
  available: Boolean!
  currentLocation: GeoPoint
}

type TripOrder {
  orderId: ID!
  order: Order # Resolver → GET /v1/orders/{orderId} (DataLoader) — deferido (D8)
  pickupBranchId: ID!
  deliveryAddress: Address
  status: OrderStatus!
}

type TripOffer {
  id: ID!
  orderCount: Int!
  distanceKm: Float!
  estimatedMinutes: Int!
  estimatedEarnings: Float!
}

type Trip {
  id: ID!
  riderId: ID!
  status: TripStatus!
  orders: [TripOrder!]!
  startedAt: String
  completedAt: String
  earnings: Float
}

input UpdateRiderProfileInput {
  vehicle: String
  phone: String
}

type Query {
  riderProfile: Rider!
  tripOffers: [TripOffer!]!
  trip(id: ID!): Trip!
  myTrips(page: PageInput): [Trip!]!
}

type Mutation {
  updateRiderProfile(input: UpdateRiderProfileInput!): Rider!
  setRiderAvailability(online: Boolean!): Rider!
  updateRiderLocation(lat: Float!, lng: Float!): Rider!
  acceptTripOffer(offerId: ID!): Trip!
  rejectTripOffer(offerId: ID!): Boolean!
  markOrderPickup(tripId: ID!, orderId: ID!): Trip!
  markOrderDelivered(tripId: ID!, orderId: ID!): Trip!
}
```

## 3.4 Mapeo Resolver → REST

| Operación GraphQL      | REST                                           | Guard (gateway) |
| ---------------------- | ---------------------------------------------- | --------------- |
| `riderProfile`         | `GET /v1/riders/me`                            | `@Roles(rider)` |
| `tripOffers`           | `GET /v1/trips/offers`                         | `@Roles(rider)` |
| `trip`                 | `GET /v1/trips/{id}`                           | `@Roles(rider)` |
| `myTrips`              | `GET /v1/trips`                                | `@Roles(rider)` |
| `updateRiderProfile`   | `PATCH /v1/riders/me`                          | `@Roles(rider)` |
| `setRiderAvailability` | `PATCH /v1/riders/me/availability`             | `@Roles(rider)` |
| `updateRiderLocation`  | `PATCH /v1/riders/me/location`                 | `@Roles(rider)` |
| `acceptTripOffer`      | `POST /v1/trips/offers/{id}/accept`            | `@Roles(rider)` |
| `rejectTripOffer`      | `POST /v1/trips/offers/{id}/reject`            | `@Roles(rider)` |
| `markOrderPickup`      | `POST /v1/trips/{id}/orders/{orderId}/pickup`  | `@Roles(rider)` |
| `markOrderDelivered`   | `POST /v1/trips/{id}/orders/{orderId}/deliver` | `@Roles(rider)` |

Todo traducido vía `DELIVERY_REST_CLIENT` + `toRestContext(ctx)`; mapeo `_id`→`id`,
`TripStatus`/`GeoPoint`/`OrderStatus` reutilizando los enums de `graphql/common`.

## 3.5 Uniones cross-service (DataLoader, RQ-GW-08/09)

- `TripOrder.order: Order` → `COMMERCE_REST_CLIENT` `GET /v1/orders/{orderId}` con
  `DataLoader`. **Depende del dominio Commerce GraphQL** (tipo `Order`) aún inexistente →
  según D8 se expone inline y `order` queda nullable hasta la fase Commerce.
- `Rider.name`/`Rider.user` (si se elige la alternativa de D2) → `AUTH_REST_CLIENT`
  `GET /v1/users/{userId}` con `DataLoader`.

---

# PARTE 4 — Dependencias sobre Commerce (fuera del alcance de Rider)

Para que Rider funcione de punta a punta, Commerce (hoy template) debe proveer:

1. `PATCH /v1/orders/{orderId}/status` con máquina de estados
   `READY_FOR_DELIVERY → ON_THE_WAY → DELIVERED` (RQ-ORD-14).
2. Emisión de `order.status_changed` ante cada transición (RQ-ORD-18), con el payload
   enriquecido de §2.7.
3. `GET /v1/orders/{id}` y `GET /v1/branches/{id}` (para `TripOrder.order` y resoluciones
   del gateway).
4. Consumo de `trip.accepted` y `trip.completed` (idempotente) para marcar asignación y
   cerrar órdenes.
5. Campo de **asignación** en `orders` (`tripId`/`riderId`) para reflejar "asignada a un
   repartidor".
6. En el gateway: dominio GraphQL `Order`/`Branch` de Commerce (para `TripOrder.order` y
   `Order.branch`).

Recomendación de secuencia: implementar Delivery con un **mock/simulacro de Commerce**
(contrato concreto de §2.7/§4) y reemplazarlo cuando Commerce exista. No bloquear Rider
esperando Commerce.

---

# PARTE 5 — Orden de implementación (fases)

| Fase  | Contenido                                                                                                                                                                                                                                                    | Salida verificable                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **0** | Confirmar D1–D8. Crear docker-compose (Mongo + RabbitMQ). Crear `config/messaging` (publisher/subscriber + esquemas versionados). Actualizar `turbo.json` (`globalEnv`). Crear `packages/contracts/openapi/delivery/delivery.openapi.yaml` (documental, D7). | Broker local levanta; envs propagados.                                                       |
| **1** | Esqueleto de Delivery: `main.ts`, `app.module.ts`, `config/{env,constants,database,security,exceptions,observability}`, `health`. Quitar template.                                                                                                           | `npm run build` / `typecheck` en `apps/delivery`.                                            |
| **2** | Dominio `rider` + onboarding lazy (D1) + cliente Auth. Endpoints `riders/me` + availability + location.                                                                                                                                                      | CRUD rider funcional contra Mongo.                                                           |
| **3** | Dominio `delivery-order` + consumidor `order.status_changed` (idempotente).                                                                                                                                                                                  | Pool se llena/vacía con eventos simulados.                                                   |
| **4** | Dominios `trip` + `offer` (orquestación): matching, Haversine, ETA, earnings, expiración, accept/reject, pickup/deliver, integración Commerce (`PATCH order status`) + eventos `trip.accepted`/`trip.completed`.                                             | Flujo completo oferta→aceptar→retirar→entregar→completado.                                   |
| **5** | Gateway: `graphql/delivery/*`, registrar módulo, DataLoader `TripOrder.order`.                                                                                                                                                                               | Playground expone `riderProfile/tripOffers/trip/myTrips` + mutations.                        |
| **6** | Tests (skill `high-quality-tests`): unit de servicios/orchestrator/guard, e2e del flujo de viaje (mongodb-memory-server + broker/Commerce mockeado), specs de resolvers del gateway.                                                                         | `npm run test` + `test:e2e` en verde.                                                        |
| **7** | Verificación global: `npm run typecheck`, `lint`, `build`, `test`. Smoke-test manual R-01…R-05 vía Playground.                                                                                                                                               | Todo verde; cobertura de `RQ-DLV-01..13`, `RQ-SEC-04/06`, `RQ-COM-04/05`, `NFR-01/02/04/05`. |

---

# PARTE 6 — Verificación (sin tests, por fase)

```bash
npm install
npm run build       # compila apps/delivery y apps/gateway
npm run typecheck   # tsc --noEmit
npm run lint        # eslint --max-warnings 0
```

Smoke-test manual end-to-end (una vez Commerce esté simulado o implementado):

```bash
npm run dev          # levanta gateway (4000) + delivery (4203)
# en el playground (http://localhost:4000/graphql):
#   query { riderProfile }
#   mutation { setRiderAvailability(online: true) }
#   mutation { updateRiderLocation(lat: ..., lng: ...) }
#   query { tripOffers }
#   mutation { acceptTripOffer(offerId: "...") }
#   mutation { markOrderPickup(tripId: "...", orderId: "...") }
#   mutation { markOrderDelivered(tripId: "...", orderId: "...") }
#   query { myTrips }
```

---

# PARTE 7 — Checklist de cobertura de requerimientos

- [ ] RQ-DLV-01 disponibilidad online/offline.
- [ ] RQ-DLV-02 compartir ubicación.
- [ ] RQ-DLV-03 ofertas según ubicación, desde órdenes `READY_FOR_DELIVERY` (sin lista global).
- [ ] RQ-DLV-04 viaje agrupa 1..N órdenes (distintos clientes/sucursales).
- [ ] RQ-DLV-05 aceptar/rechazar; la oferta vence si no responde.
- [ ] RQ-DLV-06 al aceptar, el viaje pasa a "en curso".
- [ ] RQ-DLV-07 marcar retiro y entrega (`DELIVERED`) por orden.
- [ ] RQ-DLV-08 al entregar la última orden, el viaje queda completado.
- [ ] RQ-DLV-09 el repartidor no modifica ítems ni cancela órdenes.
- [ ] RQ-DLV-10 historial de viajes.
- [ ] RQ-DLV-11 gestión de perfil (nombre, vehículo, teléfono).
- [ ] RQ-DLV-12 eventos `trip.accepted` y `trip.completed`.
- [ ] RQ-DLV-13 endpoints REST listados en §2.
- [ ] RQ-COM-03/04/05 eventos versionados, correlación, idempotencia.
- [ ] RQ-SEC-04/06 RBAC rider + solo viajes propios.
- [ ] NFR-01/02/04/05/08 índices, stateless, idempotencia, envelope de errores, health.
- [ ] Trazabilidad R-01…R-05 (§15) mapeada a los endpoints de §1.2.

---

# Anexo — Pendientes / temas abiertos

| #   | Tema                                           | Referencia | Qué falta                                                                                             |
| --- | ---------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Validación de sucursal al crear `branch_admin` | RQ-AUTH-13 | Heredado del plan de auth (no bloquea Rider).                                                         |
| 2   | Broker en Commerce                             | §9         | Commerce debe emitir/consumir los eventos de §2.7 (Parte 4).                                          |
| 3   | Tipo `Order` GraphQL de Commerce               | D8         | Bloquea `TripOrder.order`; se expone nullable hasta la fase Commerce.                                 |
| 4   | Parámetros de oferta como datos de negocio     | D5         | Hoy como env vars; evaluar mover a una colección si el admin debe editarlos.                          |
| 5   | `PageInfo` para `myTrips`                      | §3.3       | Se expone como `[Trip!]`; agregar `TripPage { data, pageInfo }` cuando el frontend haga "cargar más". |
