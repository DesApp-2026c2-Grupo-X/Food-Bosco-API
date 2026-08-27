# Plan — Commerce Service + dominio GraphQL Commerce (API Gateway)

> Plan de implementación del backend comercial: **Commerce Service** (`apps/commerce`, puerto `4202`) y la extensión del **API Gateway** (`apps/gateway`, puerto `4000`) con el dominio GraphQL de Commerce.

**Fecha:** 2026-08-26

**Fuentes de verdad:**

- `../requerimientos-backend-rest.md` §3, §4, §5, §7, §9, §10, §11.2, §12, §13, §15
- `../requerimientos-frontend.md` §1.4, §6 (Tienda), §8 (Admin sucursal), §10 (Admin global)
- `../fundamentacion-gateway-graphql-rest.md`
- `.claude/skills/orchestrator-domain-architecture`
- `.claude/skills/domain-patterns`
- `../auth/plan.md` y `../delivery/plan.md` (patrones de referencia ya implementados)

---

## 0. Objetivo del plan

Entregar **de punta a punta** el backend comercial para que las apps Tienda, Admin de
sucursal y Admin global puedan consumirlo a través del gateway:

1. **Commerce Service** (`apps/commerce`, puerto `4202`) — implementación completa
   (catálogo, sucursales, carrito, pedidos, stock, reportes y configuración).
2. **API Gateway** — extensión del esquema GraphQL con el dominio `commerce` (tipos,
   queries y mutations) traduciendo a REST contra el Commerce Service, incluyendo las
   uniones cross-service (`Order.client`, `Order.branch`, `Product.category`,
   `RecipeItem.ingredient`, `CartItem.product`) vía `DataLoader`.
3. **Integración con el resto de la arquitectura** — emisión de `order.status_changed`
   (hacia Delivery), consumo idempotente de `trip.accepted`/`trip.completed` (desde
   Delivery), y re-validación de JWT/RBAC (defensa en profundidad).

El gateway ya tiene la infraestructura transversal lista (JWT/RBAC, `RestClient`,
`DataLoader`, formateo de errores, health, `requestId`) y `COMMERCE_REST_CLIENT`
declarado. La extensión consiste en **definir el esquema GraphQL del dominio commerce y
sus resolvers**, reutilizando esa infraestructura.

---

# PARTE 1 — Análisis y decisiones

## 1.1 Estado actual (verificado en el repo)

| App / paquete  | Estado real                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/auth`    | Implementado por completo (usuarios, auth, direcciones, recuperación, seed). Expone `GET /v1/users/{userId}` (interno) y `GET /v1/addresses/{addressId}` (customer).                                                                                                                                 |
| `apps/delivery`| Implementado por completo. Emite `trip.accepted`/`trip.completed`; consume `order.status_changed`; llama `PATCH /v1/orders/{id}/status` (Commerce) y `GET /v1/orders/{id}`, `GET /v1/branches/{id}`.                                                                                                |
| `apps/gateway` | Infraestructura transversal lista + dominios GraphQL `auth` y `delivery`. `COMMERCE_REST_CLIENT`, `DataLoader`, `RestClient`, `@Roles`/`@Authenticated`, enums de `graphql/common` listos. **Falta el dominio GraphQL `commerce`.**                                                                   |
| `apps/commerce`| **Template NestJS vacío** (app.controller/service + main en 4202). Sin dependencias de Mongo/validación/JWT/eventos. **Hay que construirlo desde cero.**                                                                                                                                             |
| Broker/eventos | Abstracción `config/messaging` ya existe en Delivery (event-bus + transports in-process/RabbitMQ + esquemas de eventos `order.status_changed`, `trip.accepted`, `trip.completed`). Se **replica** en Commerce (con queue prefix `commerce`).                                                          |

## 1.2 Requerimientos explícitos de backend (Commerce)

Fuente: `requerimientos-backend-rest.md` §7.1–§7.7, §9, §10, §11.2, §15.

### 7.1 Catalog

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| GET/POST | `/v1/catalog/categories` | público (activas) / `super_admin` |
| GET/PATCH | `/v1/catalog/categories/{id}` | `super_admin` (by-id también público para resolución, RQ-CAT-14) |
| PATCH | `/v1/catalog/categories/{id}/active` | `super_admin` |
| GET/POST | `/v1/catalog/products` | público / `super_admin` |
| GET/PATCH | `/v1/catalog/products/{id}` | público / `super_admin` |
| PATCH | `/v1/catalog/products/{id}/available` | `super_admin` |
| GET/POST | `/v1/catalog/products/{id}/configurations` | `super_admin` |
| PATCH/DELETE | `/v1/catalog/products/{id}/configurations/{groupId}` | `super_admin` |
| POST/PATCH/DELETE | `.../configurations/{groupId}/options/{optionId?}` | `super_admin` |
| GET/PUT | `/v1/catalog/products/{id}/recipe` | `super_admin` |
| POST/PATCH/DELETE | `/v1/catalog/products/{id}/recipe/items/{itemId?}` | `super_admin` |
| GET/POST | `/v1/catalog/ingredients` | `super_admin` |
| PATCH | `/v1/catalog/ingredients/{id}` (+`/active`) | `super_admin` |
| GET/POST | `/v1/catalog/promotions` | `super_admin` |
| GET/PATCH | `/v1/catalog/promotions/{id}` (+`/active`) | `super_admin` |

### 7.2 Branch

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| GET/POST | `/v1/branches` | `super_admin` |
| GET/PATCH | `/v1/branches/{id}` (+`/active`) | público/admin / `super_admin` |
| GET/PUT | `/v1/branches/{id}/hours` | público/admin / `super_admin` |
| GET | `/v1/branches/available?lat=&lng=` | público |
| GET | `/v1/branches/{id}/products` | `branch_admin` (su sucursal) |
| PATCH | `/v1/branches/{id}/products/{productId}/availability` | `branch_admin` |

### 7.3 Cart

`GET /v1/carts`, `POST /v1/carts/items`, `PATCH /v1/carts/items/{id}`, `DELETE /v1/carts/items/{id}`, `POST /v1/carts/confirm` — `customer`.

### 7.4 Order

`GET /v1/orders`, `POST /v1/orders`, `GET /v1/orders/{id}`, `GET /v1/orders/{id}/history`, `GET /v1/orders/{id}/transitions`, `PATCH /v1/orders/{id}/status`, `POST /v1/orders/{id}/repeat`.

### 7.5 Stock

`GET /v1/stock`, `POST /v1/stock/adjustments` — `branch_admin`/`super_admin`.

### 7.6 Reporting

`GET /v1/reporting/products/{best-sellers|least-sold|out-of-stock|highest-revenue}` — `branch_admin`/`super_admin`.

### 7.7 Config

`GET /v1/config/parameters`, `PATCH /v1/config/parameters/{key}` (`super_admin`);
`GET /v1/config/order-states`, `POST`, `PUT /v1/config/order-states/{code}`, `PATCH .../active`.

### Eventos (§9, RQ-COM)

- Emite `order.status_changed` ante cada transición (consumido por Delivery).
- Consume `trip.accepted` (marca órdenes asignadas a repartidor) y `trip.completed`
  (cierre de viaje), de forma idempotente.
- Efectos internos (descuento de stock en `PREPARING`, reportes) **sin broker**.

### Seguridad (§10)

- Re-validación JWT + RBAC (defensa en profundidad, RQ-SEC-04).
- `branch_admin` opera solo su sucursal (`branchId` del JWT, RQ-SEC-05).

## 1.3 Decisiones de diseño

| # | Tema | Decisión | Fundamento |
| -- | ---- | -------- | ---------- |
| D1 | Estructura | Misma de `auth`/`delivery`: dominio → `controller` → `orchestrator`/`servicio` → `repository` → BD. Orchestrators viven en su dominio (como `offer.orchestrator`). | skill `orchestrator-domain-architecture` + consistencia. |
| D2 | Módulos de dominio | Se separa por entidad de negocio: `category`, `product`, `ingredient`, `promotion`, `branch`, `cart`, `order`, `stock`, `reporting`, `parameter`, `order-state`. | Evita colisión de nombre con `src/config` y mantiene un dominio por carpeta. |
| D3 | Parámetros de sistema | `ParameterService` (dominio `parameter`) se inyecta en `BranchService`/`OrderOrchestrator` para leer `MAX_DISTANCE_KM`, `BASE_PREP_MIN`, `AVG_SPEED_KMH`. Se interpreta como **acceso a configuración** (RQ-CFG-03/04 dicen literalmente "el módulo de Branch/Order deberá leer …"), no como coordinación entre servicios primarios. | RQ-CFG-03/04. |
| D4 | Dirección en `POST /v1/orders` | El gateway valida la dirección contra Auth y envía el snapshot (`addressId` + `deliveryAddress { text, latitude, longitude }`). Commerce **no** llama a Auth (RQ-COM-07, RQ-ORD-02). | RQ-ORD-02/05. |
| D5 | Número de pedido | `number` secuencial zero-padded de 6 dígitos derivado del conteo de órdenes (`count+1`). Se documenta la limitación de concurrencia (aceptable en este alcance). | `Pedido #000123` (T-12), NFR-01 indexa `number`. |
| D6 | Descuento de stock | El `OrderOrchestrator` descuenta stock al transicionar a `PREPARING` llamando a `StockService` (interno, sin broker). Se registra `stockMovements{reason:'preparing'}`. | RQ-STK-07/08, RQ-COM-02. |
| D7 | Asignación de repartidor | Consumo de `trip.accepted` → `orders.updateMany({riderId, tripId})`. `trip.completed` → no-op idempotente (el estado ya lo transicionó Delivery vía REST). | §9, RQ-COM-05. |
| D8 | Máquina de estados | Transiciones fijas en código (`order`), catálogo de visualización en `order-states` (`order-state`). `availableTransitions`/`transitions` derivan de la matriz. | RQ-ORD-14/20, RQ-CFG-07. |
| D9 | Stock por ingrediente | `branchStock{branchId, ingredientId, quantity}` único por `(branchId, ingredientId)`. La validación al confirmar suma, por ingrediente, `receta.quantity × item.quantity` y compara contra `branchStock`. | RQ-STK-01/05/06. |
| D10 | Receta con opciones (RQ-CAT-12) | `recipe[]` = `{ ingredientId, quantity, optionAdjustments?: [{ optionId, quantity }] }`. Si una opción seleccionada figura en `optionAdjustments`, reemplaza la cantidad base del ingrediente para el cálculo de stock. | RQ-CAT-12, frontend G-06. |
| D11 | Broker | Réplica de `config/messaging` de Delivery (in-process si `BROKER_URL` vacío, RabbitMQ si no), queue prefix `commerce`, exchange `fastfood.events`. | Consistencia con Delivery. |
| D12 | Uniones cross-service (gateway) | `DataLoader` por request (sobre `ctx.req`) para `Order.client` (Auth), `Order.branch`/`Product.category`/`RecipeItem.ingredient`/`CartItem.product` (Commerce). | RQ-GW-08/09. |

## 1.4 Seguridad por endpoint (resumen de guards del servicio)

- Catálogo: lectura pública de `categories`/`products`/by-id; mutaciones `super_admin`.
- `ingredients` (lista): `super_admin`; `ingredient/{id}` público (resolución).
- Sucursales: lectura by-id/horas/available pública; CRUD `super_admin`; disponibilidad por producto `branch_admin` (validando `branchId` del JWT).
- Carrito/pedidos: `customer` (operar lo propio); `orders`/`order/{id}` también `branch_admin`/`super_admin` con scope de sucursal.
- Stock/reportes: `branch_admin` (su sucursal) / `super_admin` (todas).
- Parámetros: `super_admin`. Estados de pedido: lectura autenticada, escritura `super_admin`.

---

# PARTE 2 — Commerce Service

## 2.1 Alcance

Implementar el Commerce Service completo (puerto `4202`), dueño de las colecciones
`categories`, `products`, `branchProductAvailability`, `ingredients`, `promotions`,
`branches`, `carts`, `orders`, `branchStock`, `stockMovements`, `parameters`,
`orderStates`.

Cubre `RQ-CAT-01..16`, `RQ-BRN-01..08`, `RQ-CART-01..10`, `RQ-ORD-01..20`,
`RQ-STK-01..10`, `RQ-REP-01..06`, `RQ-CFG-01..08`, `RQ-COM-03/04/05`, `RQ-SEC-04/05`,
`RQ-REST-04/07`, `NFR-01/02/04/05/08`.

## 2.2 Decisiones técnicas

Igual que `auth`/`delivery`: `@nestjs/mongoose` + `mongoose`, `jsonwebtoken`,
`class-validator` + `class-transformer` (ValidationPipe global), `config/env.ts`,
`RolesGuard` (JWT + RBAC + `@CurrentUser`), `HttpExceptionFilter` (envelope
`{ code, message, path }`), Haversine propio en `config/geo/distance.ts`, `fetch` para
clientes HTTP (no se necesita en Commerce, salvo eventos), `amqplib` para el broker.

**Dependencias nuevas en `apps/commerce/package.json`:**

- `@nestjs/mongoose`, `mongoose`
- `jsonwebtoken` (+ `@types/jsonwebtoken`)
- `class-validator`, `class-transformer`
- `dotenv`
- `amqplib` (+ `@types/amqplib`)
- dev: `mongodb-memory-server`

## 2.3 Variables de entorno

| Variable | Default (dev) | Uso |
| -------- | ------------- | --- |
| `PORT` | `4202` | Puerto HTTP. |
| `MONGODB_URI` | `mongodb://localhost:27017/fastfood` | Conexión MongoDB. |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto compartido. |
| `INTERNAL_API_TOKEN` | `dev-internal-token` | Token interno (endpoints cross-service). |
| `BROKER_URL` | (vacío) | Broker RabbitMQ; vacío → bus en proceso. |
| `SEED_PARAM_*` | — | (opcional) valores iniciales de parámetros. |

Se documenta en `apps/commerce/.env.example`. Se actualiza `turbo.json` `globalEnv`
(agrega `SEED_PARAMETER_*` si aplica; `BROKER_URL`/`JWT_SECRET`/`MONGODB_URI`/`PORT`
ya existen).

## 2.4 Estructura por dominio

```text
apps/commerce/src/
├── main.ts / app.module.ts
├── config/
│   ├── env.ts · constants.ts
│   ├── database/database.module.ts
│   ├── security/ (jwt.service, roles.decorator, roles.guard, authenticated.decorator,
│   │              current-user.decorator, internal.decorator, security.module)
│   ├── exceptions/ (domain.exception, http-exception.filter)
│   ├── geo/distance.ts (haversineDistanceKm, estimateMinutes)
│   ├── messaging/ (events, transport, in-process.transport, rabbit.transport,
│   │               event-bus, messaging.module)
│   └── observability/request-id.middleware.ts
├── health/
├── category/ · product/ · ingredient/ · promotion/
├── branch/
├── cart/
├── order/          # order.service + order.orchestrator (create/changeStatus/repeat)
├── stock/
├── reporting/
├── parameter/
├── order-state/
└── seed/           # seed de parameters + orderStates
```

Regla de oro respetada: ningún servicio primario importa otro servicio primario. Las
coordinaciones (confirmar pedido, cambiar estado, repetir pedido) viven en
`order.orchestrator.ts`.

## 2.5 Modelos de datos (colecciones Commerce, §11.2)

`categories`, `products` (con `configGroups[]` y `recipe[]`),
`branchProductAvailability` (unique `(branchId, productId)`), `ingredients`,
`promotions`, `branches` (con `hours[]`), `carts` (con `items[]`), `orders` (con
`items[]`, `deliveryAddress` snapshot, `statusHistory[]`, y campos `riderId`/`tripId`
para asignación D7), `branchStock` (unique `(branchId, ingredientId)`),
`stockMovements`, `parameters` (unique `key`), `orderStates` (unique `code`).

## 2.6 Lógica clave

- **Confirmar pedido (`OrderOrchestrator.create`)** (RQ-ORD-01..10):
  1. carrito activo del cliente, no vacío.
  2. asignar sucursal activa + abierta + dentro de `MAX_DISTANCE_KM` más cercana
     (a la dirección de entrega); si no hay → error (RQ-ORD-03/04).
  3. validar stock de ingredientes de la sucursal contra la receta de cada ítem
     (RQ-STK-06); si falta → error.
  4. snapshot de ítems (nombre, `unitPrice`, opciones, subtotal) y de dirección;
     calcular `total`; `estimatedDeliveryAt` (ETA = `BASE_PREP_MIN` + traslado por
     `AVG_SPEED_KMH`); estado `PENDING`; `number` secuencial.
  5. marcar carrito `confirmed` (RQ-ORD-10 / RQ-CART-08/09).
- **Cambiar estado (`OrderOrchestrator.changeStatus`)** (RQ-ORD-14/15, RQ-STK-07/08):
  valida transición contra la matriz; registra `statusHistory`; si → `PREPARING`
  descuenta stock (interno); emite `order.status_changed`.
- **Repetir pedido (`OrderOrchestrator.repeat`)** (RQ-ORD-17): crea carrito nuevo con
  productos aún disponibles; devuelve `cart` + `skippedProducts`.
- **Sucursales disponibles** (RQ-BRN-04/05/06): activas → abiertas ahora → dentro de
  `MAX_DISTANCE_KM` → más cercana.

## 2.7 Eventos (esquemas versionados, RQ-COM-04)

| Evento | Rol Commerce | Payload |
| ------ | ------------ | ------- |
| `order.status_changed` | **Emite** | `{ version, eventId, orderId, status, branchId, branchLocation, deliveryAddress, occurredAt }` |
| `trip.accepted` | Consume | `{ tripId, riderId, orderIds[] }` → set `riderId`/`tripId` |
| `trip.completed` | Consume | `{ tripId, riderId, orderIds[] }` → no-op idempotente |

## 2.8 Manejo de errores

Envelope `{ code, message, path }` (RFC 7807). Catálogo: `CATEGORY_NOT_FOUND`,
`PRODUCT_NOT_FOUND`, `INGREDIENT_NOT_FOUND`, `PROMOTION_NOT_FOUND`,
`BRANCH_NOT_FOUND`, `CART_NOT_FOUND`, `CART_CONFIRMED`, `ITEM_NOT_FOUND`,
`ORDER_NOT_FOUND`, `INVALID_TRANSITION`, `NO_BRANCH_AVAILABLE`, `INSUFFICIENT_STOCK`,
`PRODUCT_UNAVAILABLE`, `INGREDIENT_IN_USE`, `PARAMETER_NOT_FOUND`, `ORDER_STATE_NOT_FOUND`,
`INVALID_PARAMETER_VALUE`, `VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHENTICATED`,
`NOT_FOUND`, `INTERNAL_SERVER_ERROR`.

---

# PARTE 3 — Extensión del API Gateway

## 3.1 Estructura de archivos nuevos

```text
apps/gateway/src/graphql/commerce/
├── commerce.types.ts       # @ObjectType de todo el dominio + mapXxx
├── commerce.inputs.ts      # @InputType
├── commerce.dataloaders.ts # DataLoaders por request (categories/products/ingredients/branches/users/addresses)
├── commerce.resolver.ts    # Query/Mutation + @ResolveField cross-service
└── commerce.module.ts      # importa RestModule
```

Registrar `CommerceGraphqlModule` en `gateway/gateway.module.ts`.

## 3.2 Esquema GraphQL (de §4, sin cambios de nombres)

Tipos: `Category`, `Product`, `ConfigGroup`, `ConfigOption`, `RecipeItem`, `Ingredient`,
`Promotion`, `Branch`, `BranchHours`, `Cart`, `CartItem`, `Order`, `OrderItem`,
`OrderItemOption`, `OrderStatusHistory`, `RepeatOrderResult`, `BranchStock`,
`StockMovement`, `Parameter`, `OrderState`, `ProductReportRow`, `OutOfStockRow`.

Queries/Mutations: las listadas en §4 para catálogo, sucursales, carrito, pedidos,
stock, reportes y config, más `availableBranches(lat,lng)`, `branchProducts(branchId)`,
`branchStock(branchId)`, `orderHistory(id)`, `parameters`, `orderStates`.

## 3.3 Uniones cross-service (DataLoader, RQ-GW-08/09)

| Campo | Resolución |
| ----- | ---------- |
| `Order.client` | `AUTH_REST_CLIENT` `GET /v1/users/{clientId}` (DataLoader) |
| `Order.branch` | `COMMERCE_REST_CLIENT` `GET /v1/branches/{branchId}` (DataLoader) |
| `Order.deliveryAddress` | snapshot del pedido (`text/lat/lng`) + `addressId` |
| `Product.category` | `GET /v1/catalog/categories/{id}` (DataLoader) |
| `RecipeItem.ingredient` | `GET /v1/catalog/ingredients/{id}` (DataLoader) |
| `CartItem.product` | `GET /v1/catalog/products/{id}` (DataLoader) |

Los DataLoaders se instancian una vez por request (se cuelgan de `ctx.req`) para agrupar
y deduplicar (N+1).

---

# PARTE 4 — Orden de implementación (fases)

| Fase | Contenido | Salida |
| ---- | --------- | ------ |
| 0 | `planCommerce.md` (este documento) + actualizar `package.json` + `turbo.json` + `.env.example`. | Documento + deps. |
| 1 | Esqueleto Commerce: `main.ts`, `app.module.ts`, `config/*`, `health`. Quitar template. | `build`/`typecheck` en `apps/commerce`. |
| 2 | Dominios de catálogo: `category`, `ingredient`, `promotion`, `product` (configs + receta). | CRUD catálogo funcional. |
| 3 | `branch` (sucursales, horarios, disponibles, disponibilidad por producto). | Sucursales + `available`. |
| 4 | `parameter` + `order-state` + `seed`. | Config del sistema + estados. |
| 5 | `cart`. | Carrito con recálculo server-side. |
| 6 | `stock` (branchStock + movimientos) y `order` (service + orchestrator + eventos). | Confirmar/cambiar/repetir pedido + descuento de stock. |
| 7 | `reporting`. | Reportes. |
| 8 | Gateway `graphql/commerce/*` + registrar módulo + DataLoaders. | Playground expone dominio commerce. |
| 9 | Tests (skill `high-quality-tests`): unit servicios/orchestrator/guard + e2e (mongodb-memory-server + bus en proceso). | `npm run test` + `test:e2e` verde. |
| 10 | Verificación global: `typecheck`, `lint`, `build`, `test`. | Todo verde. |

---

# PARTE 5 — Verificación

```bash
npm install
npm run typecheck   # tsc --noEmit (apps/commerce y apps/gateway)
npm run lint        # eslint --max-warnings 0
npm run build
npm run test        # unit (commerce) + gateway
npm run test:e2e -- --filter @repo/commerce   # (o cd apps/commerce)
```

---

# PARTE 6 — Checklist de cobertura

- [ ] RQ-CAT-01..16 catálogo completo (categorías, productos, configs, receta, ingredientes, promociones, disponibilidad por sucursal).
- [ ] RQ-BRN-01..08 sucursales, horarios, disponibles por distancia, asignación interna.
- [ ] RQ-CART-01..10 carrito activo, ítems, recálculo server-side, confirmación.
- [ ] RQ-ORD-01..20 confirmar (sucursal+stock+snapshot+ETA), estados/transiciones, historial, repetir, evento `order.status_changed`.
- [ ] RQ-STK-01..10 stock por sucursal, ajustes, validación al confirmar, descuento en `PREPARING`, sin descuento al cancelar.
- [ ] RQ-REP-01..06 reportes best/least/out-of-stock/revenue.
- [ ] RQ-CFG-01..08 parámetros y catálogo de estados.
- [ ] RQ-COM-03/04/05 eventos versionados + idempotencia.
- [ ] RQ-SEC-04/05 RBAC + scope de sucursal.
- [ ] Trazabilidad T-05..T-18, S-02..S-07, G-01..G-15 (§15).

---

# Anexo — Riesgos y consideraciones

| # | Tema | Nota / mitigación |
| -- | ---- | ----------------- |
| 1 | Número de pedido secuencial | Conteo basado en `count+1`; bajo alta concurrencia podría colisionar. Se acepta en este alcance (sin colección de contador especificada). |
| 2 | `optionAdjustments` de receta | Estructura no normalizada en la spec; se define `{ optionId, quantity }` como reemplazo de la cantidad base al seleccionar la opción. |
| 3 | `Order.deliveryAddress` en GraphQL | Commerce guarda snapshot (`text/lat/lng`); el gateway lo expone como `Address` con `id=addressId` y campos de Auth (`label/city/postalCode`) nulos. |
| 4 | Parámetros de sistema | Se leen como configuración (D3); `ParameterService` se inyecta en Branch/Order (justificado por RQ-CFG-03/04). |
| 5 | `trip.completed` | No-op idempotente: los estados `ON_THE_WAY`/`DELIVERED` los aplica Delivery vía `PATCH /v1/orders/{id}/status` (RQ-ORD-16, D4 de delivery). |
| 6 | Stock = ingredientes (no productos) | `branchStock` es por ingrediente; la validación/descuento traduce receta → ingredientes. |
