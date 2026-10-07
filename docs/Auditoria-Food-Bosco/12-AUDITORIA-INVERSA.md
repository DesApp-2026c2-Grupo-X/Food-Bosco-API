# AUDITORÍA INVERSA — Funcionalidades en código vs requerimientos

Enfoque: partir del código y detectar lo que **existe pero no está documentado** o **contradice** los requisitos.

## 1. Frontend — funcionalidad extra

| #   | Funcionalidad                                                                      | Ubicación                                            | Clasificación                         |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| 1   | Auth como `packages/auth` (no `apps/auth`) + `apps/admin` (no `apps/admin-global`) | `packages/auth/`, `apps/*/src/App.tsx`               | (e) Contradictoria                    |
| 2   | Apollo Client (doc dice SWR)                                                       | `packages/api/src/client/apollo.ts`                  | (e) Contradictoria / (d) obsoleta     |
| 3   | Auto-registro público de rider                                                     | `useRegister.ts:40-47`, `authStore.ts:91`            | (e) Contradictoria                    |
| 4   | Bypass `?forceAuth=true` persistido                                                | `RequireAuth/index.tsx:14`                           | (c) Experimental / (e) seguridad      |
| 5   | App nativa Capacitor Android/iOS                                                   | `apps/store/capacitor.config.ts`, `android/`, `ios/` | (b) No documentada                    |
| 6   | Geocoding Geoapify                                                                 | `client/geo.ts:10`, `geoapify.ts:10`                 | (b) No documentada                    |
| 7   | Mapa Leaflet + tiles en Tienda                                                     | `InteractiveMap`, `SucursalesPage:105`               | (e) Contradictoria ("no mapa")        |
| 8   | Deep-link Google Maps (rider)                                                      | `TripOrderDetailPage:121`                            | (b) No documentada                    |
| 9   | Gate de proximidad 50 m                                                            | `TripOrderDetailPage:28,67-76`                       | (b) No documentada                    |
| 10  | Dashboard analítico (KPIs/ventas/comparación)                                      | `AdvancedReportsView`, charts                        | (b) No documentada / fuera de alcance |
| 11  | Persistencia de dirección seleccionada                                             | `addressStore.ts:10-20`                              | (a) Válida no documentada             |
| 12  | Polling 4s/5s/15s                                                                  | `OrderDetailPage:33`, `useIncomingOrder:23`          | (a) Válida                            |
| 13  | Página de edición de vehículo                                                      | `apps/rider/pages/VehicleEditPage`                   | (b) No documentada                    |

## 2. Backend — funcionalidad extra

| #   | Funcionalidad                                            | Ubicación                                              | Clasificación                            |
| --- | -------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| 14  | `POST /v1/auth/register-rider` público + `registerRider` | `auth.controller.ts:27`, `auth.resolver.ts:51`         | (e) Contradictoria                       |
| 15  | `deliveryOrders` + roster/rotación                       | `delivery-order.model.ts`, `delivery-order.service.ts` | (b) No documentada                       |
| 16  | Zonas `/v1/zones` + seeds                                | `zone/*`                                               | (d) Posiblemente obsoleta                |
| 17  | Turnos `/v1/shifts` + seeds                              | `shift/*`                                              | (d) Posiblemente obsoleta                |
| 18  | `GET /v1/branches/available/products`                    | `branch.controller.ts:60`                              | (b) No documentada                       |
| 19  | `GET /v1/reporting/overview` + `reportsOverview`         | `reporting.controller.ts:17`                           | (b) No documentada                       |
| 20  | `PATCH /v1/riders/me/vehicle` + `updateRiderVehicle`     | `rider.controller.ts:31`                               | (b) No documentada                       |
| 21  | `GET /v1/riders/by-user/:id`                             | `rider.lookup.controller.ts:10`                        | (b) No documentada                       |
| 22  | Seed controllers (`/v1/seed`, `/seed`)                   | `*/seed.controller.ts`                                 | (c) Experimental                         |
| 23  | Internal token `x-internal-token`                        | `roles.guard.ts:49`                                    | (a) Válida no documentada                |
| 24  | `/v1/uploads`                                            | gateway/commerce upload                                | (a) Válida (RQ-GW-14)                    |
| 25  | `ThrottleGuard` + `@Throttle`                            | `throttle/*`, `auth.resolver.ts:73`                    | (a) Válida (RQ-GW-10)                    |
| 26  | `StockMovement`                                          | `stock-movement.model.ts`                              | (a) Válida (RQ-STK-04)                   |
| 27  | Broker/eventos Rabbit+InProcess                          | `config/messaging/*`                                   | (a) Válida (§9)                          |
| 28  | `branchProductAvailability` (bool por sucursal)          | `branch-product-availability.model.ts`                 | (a) Válida (RQ-CAT-16)                   |
| 29  | Esquema GraphQL de rider/viaje ampliado                  | `delivery.types.ts:17,129`                             | (b) No documentada                       |
| 30  | `updateRiderProfile` solo acepta `phone`                 | `delivery.inputs.ts:4-7`                               | (e) Contradictoria (doc incluye vehicle) |

## 3. Contradicciones código ↔ requerimientos

| #   | Requerimiento                                       | Código                                               | Veredicto                                      |
| --- | --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| 1   | 5 frontends incl. `apps/auth` y `apps/admin-global` | 4 apps + `packages/auth`                             | Contradicción de arquitectura                  |
| 2   | Datos con SWR                                       | Apollo; `swr` dependencia muerta                     | Contradicción                                  |
| 3   | Solo `super_admin` crea riders                      | auto-registro público de rider                       | Contradicción de autorización                  |
| 4   | Promociones info-only, sin descuentos               | sin motor de descuentos (correcto)                   | OK                                             |
| 5   | Stock de ingredientes                               | flag booleano por producto/sucursal (complementario) | OK (no contradice)                             |
| 6   | Sin tiempo real                                     | polling + broker de eventos entre servicios          | Matiz (eventos entre servicios, no al cliente) |

## 4. Experimental / obsoleto

- Seeds de zonas/turnos sin consumidor.
- Artefactos `dist` stale.
- Controlador no registrado (`delivery/app.controller.ts`).
- Tipos GraphQL sin query (`StockMovement`).
- `STATUS.md` obsoletos.

## 5. Hallazgos más significativos

- **Arquitectura real ≠ documentada** (4 apps + paquete auth; Apollo, no SWR).
- **Auto-registro de rider** punta a punta cuando la spec lo restringe a `super_admin`.
- **Reporting extra** y **zonas/turnos** fuera de alcance.
- **Mapas y geocoding** en Tienda contradicen "no mapa".
- **`updateRiderProfile`** no cumple el input documentado (`vehicle`).
