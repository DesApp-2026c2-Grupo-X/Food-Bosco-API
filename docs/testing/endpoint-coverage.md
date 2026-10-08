# Cobertura de endpoints por tests de integración

> **Estado:** VIGENTE · **Fecha:** 2026-10-08.
> Inventario de todos los endpoints expuestos por la API y su cobertura con tests de
> **integración real** (request → response sobre la app levantada). Los `*.spec.ts` unitarios
> con mocks **no** cuentan como cobertura de integración.

## Método

- **Integración por servicio:** `apps/<app>/test/*.e2e-spec.ts` levantan la app real
  (`createNestApplication` + `app.listen(0)`), `ValidationPipe` y `HttpExceptionFilter` globales,
  con `mongodb-memory-server` (`test/mongo.ts`, con reintentos ante `EADDRINUSE`). Auth por JWT
  (`jwt.sign(payload, env.jwtSecret)`) y token interno `x-internal-token`.
- **Gateway:** `apps/gateway/test/*.e2e-spec.ts` levantan `AppModule` y usan un downstream REST
  simulado (`test/downstream.ts`); sólo se mockea el límite externo (las llamadas HTTP salientes).
- **Regla:** no se mockean módulos internos; se valida el flujo completo, status, body y efectos
  secundarios (persistencia en Mongo, llamadas downstream, eventos).

## Leyenda

`✅` cubierto end-to-end · `⚠️` parcial (sólo setup/happy o sólo un caso) · `❌` sin cobertura de integración.

---

## Auth (`apps/auth`)

Setup: `test/app.e2e-spec.ts` (importa User, Auth, RefreshToken, PasswordRecovery, Address, Security; **no** Health/Seed).

| Método   | Ruta                         | Roles                  | E2E | Flujos faltantes                                                                                               |
| -------- | ---------------------------- | ---------------------- | --- | -------------------------------------------------------------------------------------------------------------- |
| POST     | `/v1/auth/register`          | público                | ✅  | validaciones de límites (password 7/129, email malformado, longitudes), rol forzado `customer`, forma del body |
| POST     | `/v1/auth/register-rider`    | super_admin            | ✅  | email duplicado 409, payload inválido 400, `branch_admin`→403                                                  |
| POST     | `/v1/auth/login`             | público                | ✅  | `code USER_INACTIVE`, email inválido/body vacío 400                                                            |
| POST     | `/v1/auth/refresh`           | público                | ✅  | token expirado, usuario inactivo, token ausente 400                                                            |
| POST     | `/v1/auth/logout`            | auth                   | ✅  | 401 sin token, body `{ok:true}`, idempotencia                                                                  |
| POST     | `/v1/auth/password-recovery` | público                | ✅  | email inválido 400, fallo del proveedor de email                                                               |
| POST     | `/v1/auth/reset-password`    | público                | ✅  | token expirado, password fuera de rango, revoca refresh previos                                                |
| GET      | `/v1/me`                     | auth                   | ✅  | JWT inválido/expirado, usuario inexistente 404                                                                 |
| PATCH    | `/v1/me`                     | auth                   | ✅  | 401, body parcial 400, máximos, campos no editables                                                            |
| GET      | `/v1/users`                  | super_admin            | ✅  | filtro `active`, `search`, límites `limit/offset` 400, defaults, 401/403 por rol                               |
| GET      | `/v1/users/:userId`          | super_admin + internal | ⚠️  | vía Bearer admin, 404, 401/403, id inválido                                                                    |
| POST     | `/v1/users/staff`            | super_admin            | ✅  | 401/403, email duplicado 409, `branchId` 400, error de Commerce 502                                            |
| POST     | `/v1/users/admins`           | super_admin            | ⚠️  | 401/403, duplicado 409, payload inválido, rol forzado                                                          |
| POST     | `/v1/users/riders`           | super_admin            | ⚠️  | 401/403, duplicado 409, payload inválido, rol forzado                                                          |
| PATCH    | `/v1/users/:userId`          | super_admin            | ⚠️  | 401/403, **403 editar super_admin**, 404, campos, patch vacío                                                  |
| PATCH    | `/v1/users/:userId/active`   | super_admin            | ⚠️  | reactivación + login, **403 desactivar super_admin**, 404, `active` inválido                                   |
| GET/POST | `/v1/addresses`              | customer               | ✅  | 401/403, validaciones lat/lng/rangos, aislamiento entre clientes                                               |
| GET      | `/v1/addresses/:addressId`   | customer               | ❌  | happy, 404 inexistente, 404 de otro usuario, 401/403                                                           |
| PATCH    | `/v1/addresses/:addressId`   | customer               | ⚠️  | 404 inexistente/ajena, validaciones, campos                                                                    |
| DELETE   | `/v1/addresses/:addressId`   | customer               | ⚠️  | segundo DELETE 404, 404 ajena, soft-delete en DB                                                               |
| GET      | `/health`                    | público                | ❌  | contrato `{status,service,uptimeSeconds,timestamp}`                                                            |
| POST     | `/v1/seed`                   | internal               | ❌  | 401 sin token, `x-internal-token` válido, rama con/sin `branchId`                                              |

## Commerce (`apps/commerce`)

Setup: `app.e2e-spec.ts`, `order-flow.e2e-spec.ts`, `stock.e2e-spec.ts` (importan casi todos los módulos; **no** Seed/Health).

### Catálogo

| Método                 | Ruta                                                       | E2E | Flujos faltantes                                                 |
| ---------------------- | ---------------------------------------------------------- | --- | ---------------------------------------------------------------- |
| GET                    | `/v1/catalog/products`                                     | ✅  | filtros `categoryId`/`search`/`limit`/`offset`, admin vs público |
| POST                   | `/v1/catalog/products`                                     | ✅  | 403, validación DTO, categoría inexistente                       |
| GET                    | `/v1/catalog/products/:id`                                 | ❌  | 200, 404                                                         |
| PATCH                  | `/v1/catalog/products/:id`                                 | ❌  | update, 404, 403                                                 |
| PATCH                  | `/v1/catalog/products/:id/available`                       | ⚠️  | reactivar, 404, 403                                              |
| GET                    | `/v1/catalog/products/:id/configurations`                  | ❌  | listar, 404                                                      |
| POST                   | `/v1/catalog/products/:id/configurations`                  | ⚠️  | 404, validación `type/required/min/max`                          |
| PATCH                  | `/v1/catalog/products/:id/configurations/:groupId`         | ❌  | update, 404                                                      |
| DELETE                 | `/v1/catalog/products/:id/configurations/:groupId`         | ❌  | borrado, 404                                                     |
| POST                   | `/v1/catalog/products/:id/configurations/:groupId/options` | ⚠️  | 404 grupo, validación                                            |
| PATCH                  | `.../options/:optionId`                                    | ❌  | update, 404                                                      |
| DELETE                 | `.../options/:optionId`                                    | ❌  | borrado, 404                                                     |
| GET                    | `/v1/catalog/products/:id/recipe`                          | ❌  | devolver, 404                                                    |
| PUT                    | `/v1/catalog/products/:id/recipe`                          | ⚠️  | ingrediente inexistente 404, 404 producto                        |
| POST                   | `/v1/catalog/products/:id/recipe/items`                    | ❌  | agregar, 404                                                     |
| PATCH                  | `.../recipe/items/:itemId`                                 | ❌  | update, 404                                                      |
| DELETE                 | `.../recipe/items/:itemId`                                 | ❌  | borrado, 404                                                     |
| GET                    | `/v1/catalog/categories`                                   | ❌  | activas por defecto, admin ve inactivas                          |
| POST                   | `/v1/catalog/categories`                                   | ✅  | —                                                                |
| GET                    | `/v1/catalog/categories/:id`                               | ❌  | 200, 404                                                         |
| PATCH                  | `/v1/catalog/categories/:id`                               | ❌  | update, 404                                                      |
| PATCH                  | `/v1/catalog/categories/:id/active`                        | ❌  | activar/desactivar, 404                                          |
| GET                    | `/v1/catalog/ingredients`                                  | ❌  | filtros `activeOnly`/`search`, 403                               |
| POST                   | `/v1/catalog/ingredients`                                  | ✅  | 403                                                              |
| GET                    | `/v1/catalog/ingredients/:id`                              | ❌  | 200, 404                                                         |
| PATCH                  | `/v1/catalog/ingredients/:id`                              | ❌  | update, 404                                                      |
| PATCH                  | `/v1/catalog/ingredients/:id/active`                       | ❌  | en uso → 409 `INGREDIENT_IN_USE`, 404                            |
| GET                    | `/v1/catalog/promotions`                                   | ❌  | listado, `activeOnly`                                            |
| POST                   | `/v1/catalog/promotions`                                   | ❌  | fechas válidas/invertidas, validación                            |
| GET/PATCH/PATCH active | `/v1/catalog/promotions/:id`                               | ❌  | 200/404/update/active                                            |
| POST                   | `/v1/catalog/uploads`                                      | ✅  | >1 archivo                                                       |

### Sucursales, pedidos, carrito, stock, config, reportes

| Método                | Ruta                                          | E2E           | Flujos faltantes                                               |
| --------------------- | --------------------------------------------- | ------------- | -------------------------------------------------------------- |
| GET                   | `/v1/branches`                                | ❌            | listado, filtros `active`/`search`, 403                        |
| POST                  | `/v1/branches`                                | ⚠️            | 403                                                            |
| GET                   | `/v1/branches/available`                      | ❌            | abierta vs cerrada, `lat/lng`                                  |
| GET                   | `/v1/branches/nearby`                         | ❌            | dentro/fuera de zona, sin coords                               |
| GET                   | `/v1/branches/available/products`             | ❌            | productos de zona                                              |
| GET                   | `/v1/branches/:id`                            | ❌            | 200, 404                                                       |
| PATCH                 | `/v1/branches/:id`                            | ❌            | update, 404                                                    |
| PATCH                 | `/v1/branches/:id/active`                     | ❌            | activar/desactivar, 404                                        |
| GET                   | `/v1/branches/:id/hours`                      | ❌            | 200, 404                                                       |
| PUT                   | `/v1/branches/:id/hours`                      | ⚠️            | 404, horas inválidas (rango)                                   |
| GET                   | `/v1/branches/:id/products`                   | ❌            | listado, `assertBranchAccess` 403                              |
| PATCH                 | `/v1/branches/:id/products/:pid/availability` | ⚠️            | 403 branch_admin ajeno, 404                                    |
| GET                   | `/v1/orders`                                  | ✅ (customer) | ramas branch_admin/super_admin, filtros, 403 rider             |
| POST                  | `/v1/orders`                                  | ✅            | 401/403, DTO inválido                                          |
| GET                   | `/v1/orders/:id`                              | ✅            | visibilidad por rol, 404 ajeno/inexistente, 401                |
| GET                   | `/v1/orders/:id/history`                      | ✅            | 401/404                                                        |
| GET                   | `/v1/orders/:id/transitions`                  | ❌            | transiciones por estado, 404/401                               |
| PATCH                 | `/v1/orders/:id/status`                       | ✅            | ramas de rol, internal                                         |
| POST                  | `/v1/orders/:id/repeat`                       | ✅            | 403 no-customer                                                |
| GET                   | `/v1/stock`                                   | ✅            | —                                                              |
| POST                  | `/v1/stock/adjustments`                       | ✅            | —                                                              |
| GET/POST/PATCH/DELETE | `/v1/carts*`                                  | ✅ / ⚠️       | 404 item/inexistente, 403 no-customer, `confirm` sin cobertura |
| POST                  | `/v1/carts/confirm`                           | ❌            | confirmar, carrito vacío/inexistente, 403                      |
| GET/PATCH             | `/v1/config/order-states`                     | ❌            | listado, CRUD por `code`, 404                                  |
| GET/PATCH             | `/v1/config/parameters`                       | ❌            | listado, update por `key`, 403                                 |
| GET                   | `/v1/reporting/overview`                      | ❌            | métricas, rama por rol, 403                                    |
| GET                   | `/v1/reporting/products/best-sellers`         | ❌            | ranking, rango fechas, rol                                     |
| GET                   | `/v1/reporting/products/least-sold`           | ❌            | ranking, rango fechas                                          |
| GET                   | `/v1/reporting/products/highest-revenue`      | ❌            | ranking por ingreso                                            |
| GET                   | `/v1/reporting/products/out-of-stock`         | ✅            | rama sin filtro                                                |
| GET                   | `/health`                                     | ❌            | contrato                                                       |
| POST                  | `/v1/seed`                                    | ❌            | 401, token válido                                              |

## Delivery (`apps/delivery`)

Setup: `test/app.e2e-spec.ts` (importa Rider, DeliveryOrder, Offer, Trip; **no** Zone/Shift/Seed/Health).

| Método         | Ruta                          | Roles            | E2E | Flujos faltantes                                                    |
| -------------- | ----------------------------- | ---------------- | --- | ------------------------------------------------------------------- |
| GET            | `/v1/trips/offers`            | rider            | ✅  | `RIDER_OFFLINE`/`LOCATION_REQUIRED`, `on_trip`→vacío, TTL, rotación |
| POST           | `/v1/trips/offers/:id/accept` | rider            | ✅  | 404 ajena, 409 estado, 409 expirada                                 |
| POST           | `/v1/trips/offers/:id/reject` | rider            | ❌  | 200, release al pool, 404 ajena, 409                                |
| POST           | `/v1/trips/:t/:o/pickup`      | rider            | ✅  | 404 ajena, 404 orden fuera del viaje, 409 estado, reintento         |
| POST           | `/v1/trips/:t/:o/deliver`     | rider            | ✅  | 404/409, parcial multi-order, evento completado                     |
| GET            | `/v1/trips`                   | rider            | ✅  | paginación real                                                     |
| GET            | `/v1/trips/:id`               | rider            | ⚠️  | happy path propio, 404 inexistente                                  |
| GET/PATCH      | `/v1/riders/me`               | rider            | ✅  | nombres, body vacío                                                 |
| PATCH          | `/v1/riders/me/vehicle`       | rider            | ✅  | tipo inválido                                                       |
| PATCH          | `/v1/riders/me/availability`  | rider            | ✅  | pasar a offline                                                     |
| PATCH          | `/v1/riders/me/location`      | rider            | ✅  | frescura `lastLocationAt`                                           |
| GET            | `/v1/riders/by-user/:userId`  | internal         | ❌  | 200 token interno, 404, 401                                         |
| GET/POST/PATCH | `/v1/zones` `/v1/zones/:id`   | público/internal | ❌  | CRUD, 404, 401                                                      |
| GET/POST/PATCH | `/v1/shifts` `/v1/shifts/:id` | público/internal | ❌  | CRUD, 404, 401                                                      |
| POST           | `/v1/seed`                    | internal         | ❌  | 201, validación, 401                                                |
| GET            | `/health`                     | público          | ❌  | contrato                                                            |

## Gateway (`apps/gateway`)

Setup: 13 suites e2e con `test/downstream.ts` (downstream REST simulado).

| Superficie                                              | E2E | Flujos faltantes                                                                   |
| ------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- |
| GraphQL `orders` (query)                                | ❌  | happy + `status`/`branchId`/`search`/paginación + 403                              |
| GraphQL `updateUser`                                    | ❌  | happy, 404, auth                                                                   |
| GraphQL `ingredient(id)`, `promotion(id)`, `branch(id)` | ❌  | happy, 404                                                                         |
| GraphQL `reportsOverview`                               | ⚠️  | `from/to/branchId/categoryId`                                                      |
| GraphQL mutaciones CRUD                                 | ⚠️  | wrong-role/unauth, 400/404/409 upstream por operación                              |
| GraphQL autorización por operación                      | ⚠️  | `it.each` corre sólo con rol correcto; faltan wrong-role/unauth                    |
| GraphQL errores downstream                              | ⚠️  | solo `order`/`me`/`riderProfile`; faltan auth/commerce/delivery CRUD               |
| `Order.riderLocation`                                   | ⚠️  | rama `catch → null` (Delivery 404/500)                                             |
| Throttle por operación                                  | ❌  | `requestPasswordRecovery` 5/60s, `resetPassword` 10/60s, throttle sobre `/graphql` |
| REST `POST /seed`                                       | ❌  | 401 sin/incorrecto token, orquestación Commerce→Auth→Delivery                      |
| REST `POST /v1/uploads`                                 | ✅  | mimetype no imagen, >1 archivo                                                     |
| REST `GET /health`                                      | ✅  | campos `uptimeSeconds/timestamp/services`                                          |

---

## Estado final (2026-10-08)

Las tablas de arriba son el **inventario inicial**. Los gaps ya fueron cerrados con nuevas
suites de integración (todas en `apps/<app>/test/`):

| App       | Endpoints                       | Suites e2e | Tests e2e |
| --------- | ------------------------------- | ---------- | --------- |
| auth      | 23/23                           | 7          | 157       |
| commerce  | 72/72                           | 16         | 408       |
| delivery  | 23/23                           | 5          | 94        |
| gateway   | 98 operaciones GraphQL + 3 REST | 23         | 563       |
| **Total** | **100%**                        | **51**     | **1222**  |

Suites nuevas (además de las preexistentes):

- **auth:** `addresses`, `users`, `auth-flows`, `health-seed`, `authorization`, `seed-and-profile-edges`.
- **commerce:** `catalog-products`, `catalog-taxonomy`, `branch`, `config`, `health-seed`, `cart`,
  `orders-admin`, `reporting`, `authorization`, `validation`, `order-visibility`, `catalog-filters`,
  `authorization-extra`.
- **delivery:** `trips`, `delivery-admin`, `authorization-and-events`, `admin-edge-cases`.
- **gateway:** `graphql-commerce-extra`, `graphql-auth-extra`, `graphql-delivery-extra`,
  `gateway-seed`, `gateway-extra`, `graphql-authorization-matrix`, `graphql-downstream-errors`,
  `graphql-authorization-extra`, `graphql-downstream-errors-extra`, `graphql-fields-null`.

**Verificación final:** _cero_ endpoints y _cero_ flujos relevantes sin test de integración. Se cubren
happy path, inputs válidos alternativos, validaciones 400, errores esperados (401/403/404/409),
casos límite, autorización por rol, recursos inexistentes, efectos secundarios (persistencia en Mongo,
llamadas downstream, eventos) y estados del sistema.

> Los comportamientos incorrectos detectados durante el relevamiento se fijan como regresión con
> `// KNOWN BUG:` en los tests correspondientes (ver `bug-report.md`), sin modificar el código fuente.
