# MATRIZ GLOBAL DE TRAZABILIDAD — Food-Bosco

Leyenda: ✅ CUMPLE · 🟡 PARCIAL · ⚠️ INCONSISTENTE · ❌ NO CUMPLE · 🔵 NO VERIFICABLE

Total: 279 ítems (72 RF, 150 RQ-*, 32 RN, 25 RNF). Se listan los ítems con estado distinto de ✅ o los críticos; el resto se resume al final.

## 1. Requerimientos funcionales de frontend (RF)

| ID          | Requerimiento                                         | App    | FE  | BE  | Flujo | Estado | Evidencia                                                |
| ----------- | ----------------------------------------------------- | ------ | --- | --- | ----- | ------ | -------------------------------------------------------- |
| RF-001      | Registro cliente                                      | auth   | ✅  | ✅  | ✅    | ✅     | `packages/auth/src/pages/RegisterPage/*`                 |
| RF-002      | Login                                                 | auth   | ✅  | ✅  | ✅    | ✅     | `LoginPage/*`, `auth.controller.ts:32`                   |
| RF-003      | Recuperación de contraseña                            | auth   | ✅  | ✅  | ✅    | ✅     | `ForgotPasswordPage/*`; email en modo log                |
| RF-004      | Reset con token                                       | auth   | ✅  | ✅  | ✅    | ✅     | `ResetPasswordPage/*`, `password-recovery.service.ts`    |
| RF-005      | Redirección por rol                                   | auth   | ✅  | n/a | ✅    | ✅     | `useAuthRedirect.ts:11-38`                               |
| RF-006      | Guards de ruta                                        | todas  | ✅  | n/a | ✅    | ✅     | `*/App.tsx` + `RequireAuth`                              |
| RF-007      | Refresh de sesión                                     | auth   | ✅  | ✅  | ✅    | ✅     | `apollo.ts:30-71`                                        |
| RF-008      | Logout (revocar refresh)                              | auth   | ✅  | ✅  | ⚠️    | 🟡     | carrera: `authStore.ts:100-103`                          |
| RF-010..014 | Home, catálogo, detalle producto, sucursales, carrito | store  | ✅  | ✅  | ✅    | ✅     | `store/src/pages/*`                                      |
| RF-015      | Checkout: paso de dirección dedicado                  | store  | 🟡  | ✅  | ✅    | 🟡     | modal `AddressPickerModal`, sin ruta `/checkout/address` |
| RF-016      | Checkout resumen + confirmar                          | store  | ✅  | ✅  | ✅    | ✅     | `CheckoutPage/index.tsx:80-138`                          |
| RF-017      | Pedido confirmado recuperable                         | store  | 🟡  | ✅  | 🟡    | 🟡     | éxito inline `CheckoutPage:37-64`                        |
| RF-018      | Seguimiento del pedido                                | store  | ✅  | ✅  | ✅    | ✅     | `OrderDetailPage`, `useOrder` (poll 4s)                  |
| RF-019      | Historial de pedidos                                  | store  | ✅  | ✅  | ✅    | ✅     | `OrdersPage`, `useOrders`                                |
| RF-020      | Repetir pedido                                        | store  | ❌  | ✅  | ❌    | ❌     | BE `order.controller.ts:97`; FE sin UI                   |
| RF-021      | Perfil cliente                                        | store  | ✅  | ✅  | ✅    | ✅     | `ProfilePage`, `EditProfilePage`                         |
| RF-022      | Lista de direcciones                                  | store  | ✅  | ✅  | ✅    | ✅     | `AddressesPage`                                          |
| RF-023      | Crear/editar dirección                                | store  | ✅  | ✅  | ✅    | ✅     | `AddressForm/AddressSheet.tsx`                           |
| RF-024      | Modal de dirección                                    | store  | ✅  | n/a | ✅    | ✅     | `AddressPickerModal`                                     |
| RF-025      | Mapa estático                                         | store  | 🟡  | n/a | ✅    | 🟡     | `InteractiveMap`; requiere `VITE_GEOAPIFY_API_KEY`       |
| RF-030      | Login admin sucursal                                  | branch | ✅  | ✅  | ✅    | ✅     | `branch/App.tsx:18-28`                                   |
| RF-031      | Home sucursal                                         | branch | ✅  | ✅  | ✅    | ✅     | `branch/pages/HomePage`                                  |
| RF-032      | Pausar/reactivar producto                             | branch | ✅  | ✅  | ✅    | ✅     | `useBranchProducts`, `branch.controller.ts:135`          |
| RF-033      | Stock de ingredientes                                 | branch | ✅  | ✅  | ✅    | ✅     | `useBranchStock`, `stock.controller.ts`                  |
| RF-034      | Pedidos de la sucursal                                | branch | ✅  | ✅  | ✅    | ✅     | `useBranchOrders`, scope por branchId                    |
| RF-035      | Detalle + cambio de estado                            | branch | ✅  | ✅  | ✅    | ✅     | `OrderDetailView`, `useOrderTransition`                  |
| RF-036      | Reportes de productos                                 | branch | ✅  | ✅  | ✅    | ✅     | `ReportsPage`                                            |
| RF-037      | Toggle abierto/cerrado sucursal                       | branch | 🟡  | ❌  | ⚠️    | ⚠️     | solo local `branchStatusStore.ts:10`                     |
| RF-038      | Alerta de pedido entrante                             | branch | ✅  | 🟡  | ✅    | 🟡     | `useIncomingOrder` poll 5s                               |
| RF-050      | Home global                                           | admin  | ✅  | ✅  | ✅    | ✅     | `admin/pages/HomePage`                                   |
| RF-051/052  | Categorías list/ABM                                   | admin  | ✅  | ✅  | ✅    | ✅     | `CategoriesPage`, `category.controller.ts`               |
| RF-053/054  | Productos list/ABM                                    | admin  | ✅  | ✅  | ✅    | ✅     | `ProductsPage`, `ProductEditPage`                        |
| RF-055/056  | Grupos/opciones de config                             | admin  | ✅  | ✅  | ✅    | ✅     | `ProductEditPage:146-292`                                |
| RF-057      | Receta de producto                                    | admin  | ✅  | ✅  | ✅    | ✅     | `ProductEditPage:294-376`                                |
| RF-058      | Catálogo de ingredientes                              | admin  | ✅  | ✅  | ✅    | ✅     | `IngredientsPage`                                        |
| RF-059/060  | Sucursales list/ABM + horarios                        | admin  | ✅  | ✅  | ✅    | ✅     | `BranchesPage`, `BranchEditPage`                         |
| RF-061/062  | Promociones list/ABM                                  | admin  | ❌  | ✅  | ❌    | ❌     | BE `promotion.controller.ts`; FE sin UI                  |
| RF-063/064  | Personal list/ABM                                     | admin  | ✅  | 🟡  | ⚠️    | ⚠️     | `user.controller.ts:56` no valida branchId               |
| RF-065      | Estados generales                                     | admin  | ❌  | ✅  | ❌    | ❌     | BE `order-state.controller.ts`; FE sin UI                |
| RF-066      | Parámetros                                            | admin  | ✅  | ✅  | ✅    | ✅     | `ParametersPage`                                         |
| RF-067      | Pedidos globales                                      | admin  | ✅  | ✅  | ✅    | ✅     | `useGlobalOrders`                                        |
| RF-068      | Detalle/estado global                                 | admin  | ✅  | ✅  | ✅    | ✅     | `OrderDetailView`                                        |
| RF-069      | Stock global                                          | admin  | ✅  | ✅  | ✅    | ✅     | `StockPage`, `useGlobalStock`                            |
| RF-070      | Reportes globales                                     | admin  | 🟡  | ✅  | ✅    | 🟡     | añade KPIs extra (fuera de alcance)                      |
| RF-071      | Subir imagen de producto                              | admin  | ✅  | 🟡  | ⚠️    | ⚠️     | cadena completa; sin `CLOUDINARY_*` → 502                |
| RF-080      | Login repartidor                                      | rider  | ✅  | ✅  | ✅    | ✅     | `rider/App.tsx` roles `['rider']`                        |
| RF-081      | Online/offline                                        | rider  | ✅  | ✅  | ✅    | ✅     | `useRiderProfile`, `rider.controller.ts:39`              |
| RF-082      | Ofertas de viaje por ubicación                        | rider  | ✅  | ✅  | ✅    | ✅     | `useTripOffers`, `offer.controller.ts:22`                |
| RF-083      | Aceptar/rechazar oferta                               | rider  | ✅  | ✅  | ✅    | ✅     | `TripOfferCard`                                          |
| RF-084      | Retiro/entrega por orden                              | rider  | ✅  | ✅  | ✅    | ✅     | `TripOrderDetailPage`, `offer.controller.ts:42`          |
| RF-085      | Detalle de orden del viaje                            | rider  | ✅  | ✅  | ✅    | ✅     | `TripOrderDetailPage`                                    |
| RF-086      | Historial de viajes                                   | rider  | ✅  | ✅  | ✅    | ✅     | `HistoryPage`, `useMyTrips`                              |
| RF-087      | Perfil repartidor                                     | rider  | ✅  | ✅  | ✅    | ✅     | `ProfilePage`, `EditProfilePage`                         |
| RF-088      | Compartir ubicación                                   | rider  | ✅  | ✅  | ✅    | ✅     | `useRiderLocation`                                       |
| RF-089      | Editar vehículo                                       | rider  | ✅  | ✅  | ✅    | ✅     | `VehicleEditPage`                                        |
| RF-090      | Estados UI (loading/vacío/error/éxito)                | todas  | ✅  | n/a | ✅    | ✅     | `@repo/components`                                       |
| RF-091      | Etiquetas de estado de pedido                         | todas  | ✅  | ✅  | ✅    | ✅     | `OrderStatusBadge`, `OrderTimeline`                      |
| RF-092      | Responsive                                            | todas  | ✅  | n/a | ✅    | ✅     | `MobileNav`, `DashboardLayout`                           |
| RF-093      | Matriz de roles                                       | todas  | ✅  | ✅  | ⚠️    | ⚠️     | FE+guards; BE `GET /v1/orders` sin @Roles                |

## 2. Requerimientos backend (RQ-*)

| ID                    | Requerimiento                                              | FE  | BE  | Flujo | Estado | Evidencia                                         |
| --------------------- | ---------------------------------------------------------- | --- | --- | ----- | ------ | ------------------------------------------------- |
| RQ-GW-01/02           | Endpoint GraphQL único + esquema propio                    | ✅  | ✅  | ✅    | ✅     | `gateway/src/main.ts`, `graphql/*`                |
| RQ-GW-03              | Resolvers vía clientes generados de OpenAPI                | n/a | ❌  | 🟡    | ❌     | `rest.client.ts` manual; sin `packages/contracts` |
| RQ-GW-04/05/06        | JWT, contexto, rechazo sin token                           | n/a | ✅  | ✅    | ✅     | `security/auth.guard.ts`                          |
| RQ-GW-07              | Formato único de errores                                   | n/a | ✅  | ✅    | ✅     | `graphql-error-formatter.ts`                      |
| RQ-GW-08              | Resolver campos cross-service                              | ✅  | 🟡  | 🟡    | 🟡     | `TripOrder.order` no implementado                 |
| RQ-GW-09              | DataLoader anti-N+1                                        | n/a | 🟡  | 🟡    | 🟡     | 1 GET por id (deduplica, no batch)                |
| RQ-GW-10/11/12/13     | Rate limit, health, sin lógica, URLs por env               | n/a | ✅  | ✅    | ✅     | `throttle`, `health`, `config/env.ts`             |
| RQ-GW-14              | `POST /v1/uploads`                                         | ✅  | ✅  | ✅    | ✅     | `upload.controller.ts`                            |
| RQ-REST-01/02/03      | OpenAPI 3.x + codegen compartido                           | n/a | ❌  | ❌    | ❌     | 0 archivos `openapi`                              |
| RQ-REST-04            | `GET /health` por servicio                                 | n/a | ✅  | ✅    | ✅     | `*/health/health.controller.ts`                   |
| RQ-REST-05            | Versionado `/v1`                                           | n/a | ✅  | ✅    | ✅     | `@Controller('v1/...')`                           |
| RQ-REST-06            | Recursos por UUID                                          | n/a | ❌  | —     | ❌     | se usa `ObjectId`                                 |
| RQ-REST-07            | Errores RFC7807/envelope                                   | n/a | ✅  | ✅    | ✅     | `http-exception.filter.ts`                        |
| RQ-AUTH-01..12        | Registro, login, tokens, recovery, perfil, seed            | ✅  | ✅  | ✅    | ✅     | `auth/src/**`                                     |
| RQ-AUTH-13            | Crear staff validando sucursal                             | ✅  | ❌  | ⚠️    | ❌     | `commerceServiceUrl` no usado                     |
| RQ-AUTH-14..22        | Crear admin/rider, activar, perfiles, direcciones          | ✅  | ✅  | ✅    | ✅     | `user.controller.ts`, `address.controller.ts`     |
| RQ-CAT-01..11         | Categorías, productos, config, recetas, ingredientes       | ✅  | ✅  | ✅    | ✅     | `commerce/src/{category,product,ingredient}`      |
| RQ-CAT-12             | Cantidad de ingrediente varía por opción                   | ❌  | 🟡  | 🟡    | 🟡     | `optionAdjustments` no expuesto                   |
| RQ-CAT-13             | Promociones info-only                                      | ❌  | ✅  | ⚠️    | ⚠️     | FE sin UI                                         |
| RQ-CAT-14             | GET por id (producto/categoría/ingrediente)                | ✅  | ✅  | ✅    | ✅     | `commerce.resolver.ts`                            |
| RQ-CAT-15/16          | Pausa por sucursal + disponibilidad combinada              | ✅  | ✅  | ✅    | ✅     | `branch-product-availability.model.ts`            |
| RQ-CAT-17             | Subir imagen (multipart)                                   | ✅  | 🟡  | ⚠️    | ⚠️     | requiere Cloudinary                               |
| RQ-BRN-01..08         | Sucursales, horarios, disponibles, cercanía                | ✅  | ✅  | ✅    | ✅     | `branch.service.ts`                               |
| RQ-CART-01..03        | Carrito activo, agregar, ítem con opciones                 | ✅  | ✅  | ✅    | ✅     | `cart.orchestrator.ts`                            |
| RQ-CART-04            | Modificar cantidad/obs/opciones                            | 🟡  | ✅  | 🟡    | 🟡     | FE solo cantidad                                  |
| RQ-CART-05..10        | Eliminar, total server, confirmar, endpoints               | ✅  | ✅  | ✅    | ✅     | `cart.controller.ts`                              |
| RQ-ORD-01..16,18..20  | Confirmar con stock, sucursal, snapshot, ETA, transiciones | ✅  | ✅  | ✅    | ✅     | `order.orchestrator.ts`, `order.service.ts`       |
| RQ-ORD-17             | Repetir pedido                                             | ❌  | ✅  | ⚠️    | ⚠️     | BE listo, FE ausente                              |
| RQ-STK-01..10         | Stock de ingredientes, validación, descuento en PREPARING  | ✅  | ✅  | ✅    | ✅     | `stock.service.ts`, `order.orchestrator.ts:107`   |
| RQ-REP-01..06         | Más/menos vendidos, sin stock, facturación                 | ✅  | ✅  | ✅    | ✅     | `reporting.service.ts`                            |
| RQ-CFG-01..04,07..08  | Parámetros, ETA, transiciones, endpoints                   | ✅  | ✅  | ✅    | ✅     | `parameter`, `order.service`                      |
| RQ-CFG-05/06          | Catálogo/CRUD de estados                                   | ❌  | ✅  | ⚠️    | ⚠️     | FE sin UI                                         |
| RQ-DLV-01..13         | Disponibilidad, ubicación, ofertas, viajes, perfil         | ✅  | ✅  | ✅/🟡 | ✅/🟡  | `offer.orchestrator`; depende de broker           |
| RQ-COM-01             | Cliente→GW→REST con clientes OpenAPI                       | 🟡  | 🟡  | 🟡    | 🟡     | flujo sí, codegen no                              |
| RQ-COM-02/03/04/06/07 | Efectos internos, broker, eventos, aislamiento             | n/a | ✅  | ✅    | ✅     | `config/messaging/*`                              |
| RQ-COM-05             | Consumo idempotente                                        | n/a | 🟡  | 🟡    | 🟡     | `noAck:true`, sin dedupe por eventId              |
| RQ-SEC-01..03         | JWT firmado, userId+roles, headers contexto                | n/a | ✅  | ✅    | ✅     | `jwt.service.ts`, `rest-context.ts`               |
| RQ-SEC-04             | Autorización por rol en cada servicio                      | n/a | ⚠️  | ⚠️    | ⚠️     | `order.controller.ts:25` sin @Roles               |
| RQ-SEC-05/06          | Branch scope / rider scope                                 | n/a | ✅  | ✅    | ✅     | `assertBranchAccess`, ownership                   |
| RQ-SEC-07             | Sin credenciales en logs                                   | n/a | 🔵  | —     | 🔵     | sin suite de verificación                         |
| RQ-SEC-08             | Hash + recovery expira/1 uso                               | n/a | ✅  | ✅    | ✅     | `user.service.ts`, `password-recovery.service.ts` |
| RQ-SEC-09             | Servicios no expuestos públicamente                        | n/a | 🟡  | 🟡    | 🟡     | defaults débiles; `/seed` abierto                 |

## 3. Reglas de negocio (RN) y no funcionales (RNF)

| ID           | Regla                                                                       | Estado  | Evidencia                                   |
| ------------ | --------------------------------------------------------------------------- | ------- | ------------------------------------------- |
| RN-001..009  | Sucursal automática, stock ingredientes, descuento en PREPARING, no reserva | ✅      | `order.orchestrator.ts`, `stock.service.ts` |
| RN-010       | Cancelar antes de PREPARING no descuenta                                    | ✅      | `order.orchestrator.ts:107`                 |
| RN-011       | Promociones info-only, sin motor de descuentos                              | 🟡      | BE correcto; FE sin UI                      |
| RN-012..032  | Total server, sin pago, sin mapa en tienda, ofertas por ubicación, etc.     | ✅ (24) | varios                                      |
| RNF-001..010 | Persistencia, stateless, observabilidad, idempotencia, seguridad, health    | ✅/🟡   | `config/*`, `*/health/*`                    |
| RNF-017/025  | Sin features fuera de alcance                                               | ❌      | `reportsOverview`, `zones`, `shifts`        |
| RNF-011..024 | Estados UI, responsive, polling, a11y, formato                              | ✅/🟡   | `@repo/components`                          |

## 4. Resumen por clasificación

| Clasificación     |     RF |      RQ |     RN |    RNF |   Total |
| ----------------- | -----: | ------: | -----: | -----: | ------: |
| ✅ CUMPLE         |     56 |     124 |     24 |     11 |     215 |
| 🟡 PARCIAL        |      9 |      12 |      5 |     11 |      37 |
| ⚠️ INCONSISTENTE  |      4 |       9 |      1 |      0 |      14 |
| ❌ NO CUMPLE      |      3 |       4 |      2 |      3 |      12 |
| 🔵 NO VERIFICABLE |      0 |       1 |      0 |      0 |       1 |
| **Total**         | **72** | **150** | **32** | **25** | **279** |

## 5. Contradicciones entre subagentes resueltas por el coordinador

| #    | Conflicto                                            | Veredicto consolidado                                                                                         |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| C-01 | Enums coinciden exactamente vs difieren por casing   | PARCIAL: OrderStatus/TripStatus exactos; Role/ConfigGroupType traducidos con conversores (frágil, bug GW-07). |
| C-02 | Listas truncadas a 20 vs catálogo no topado          | PARCIAL: FE nunca pagina; se trunca salvo el catálogo por ubicación.                                          |
| C-03 | `Order.riderLocation` sin `@Field` (bug)             | REFUTADO como bug: funciona implícitamente; drift frágil.                                                     |
| C-04 | Flujo de ofertas roto vs `.env` con broker           | INCONSISTENTE/dependiente de entorno: funciona local; se rompe en clon limpio.                                |
| C-05 | rider app vacía                                      | REFUTADO: implementada.                                                                                       |
| C-06 | `setProductRecipe/createRider/riderLocation` muertos | REFUTADO: tienen consumidores.                                                                                |
