# CONSISTENCIA DEL DOMINIO — Food-Bosco

Comparación entre: **FE** (`packages/domain` + `packages/api/src/client`), **GraphQL** (`apps/gateway/src/graphql`) y **BE** (Mongoose models + REST DTOs).

## 1. Matriz de conceptos

| Concepto            | FE                 | GraphQL                             | Mongoose/REST                          | Consistencia | Detalle                                                                                  |
| ------------------- | ------------------ | ----------------------------------- | -------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| User                | `user.ts:20`       | `auth.types.ts:12`                  | `user.model.ts:7`                      | ⚠️           | FE omite `vehicle`; `createdAt` fabricado en mapper; `branchId` sin FK                   |
| Address             | `address.ts:3`     | `auth.types.ts:42`                  | `address.model.ts:5`                   | ✅           | alineados                                                                                |
| Category            | `catalog.ts:3`     | `commerce.types.ts:18`              | `category.model.ts:5`                  | ✅           | `name/active`                                                                            |
| Product             | `catalog.ts:28`    | `commerce.types.ts:99`              | `product.model.ts:75`                  | ⚠️           | `recipe` con `optionAdjustments` no expuesto                                             |
| ConfigGroup/Option  | `catalog.ts:11,18` | `commerce.types.ts:30,45`           | `product.model.ts:7,23`                | ✅           | nombres distintos, campos alineados                                                      |
| Ingredient          | `ingredient.ts:1`  | `commerce.types.ts:69`              | `ingredient.model.ts:5`                | ✅           | `name/unit/active`                                                                       |
| Branch/Hours        | `branch.ts:3`      | `commerce.types.ts:168`             | `branch.model.ts:29`                   | ✅           | hours embebidos                                                                          |
| Cart                | `cart.ts:13`       | `commerce.types.ts:219`             | `cart.model.ts:26`                     | ⚠️           | `status` string vs enum `active/confirmed`                                               |
| Order               | `order.ts:42`      | `commerce.types.ts:297`             | `order.model.ts:75`                    | ⚠️           | `riderId` guarda `userId`; `addressId`/`tripId` no expuestos; `riderLocation` implícito  |
| OrderItem/Option    | `order.ts:14,20`   | `commerce.types.ts:237,249`         | `order.model.ts:7,21`                  | ✅           | `extraPrice`, `subtotal`                                                                 |
| OrderStatus/History | `order.ts:5,30`    | `order-status.enum.ts`              | `constants.ts:17`                      | ✅           | 7 estados                                                                                |
| OrderState          | `order-state.ts:1` | `commerce.types.ts:405`             | `order-state.model.ts:5`               | ❌ wiring    | tipo FE sin operación/hook                                                               |
| Stock (ingrediente) | `stock.ts:3`       | `commerce.types.ts:354`             | `branch-stock.model.ts:5`              | ✅           |                                                                                          |
| Stock (producto)    | ❌                 | ❌                                  | `branch-product-availability.model.ts` | ⚠️           | solo booleano `available` por sucursal                                                   |
| StockMovement       | ❌                 | `commerce.types.ts:369` (sin query) | `stock-movement.model.ts`              | ❌           | tipo sin resolver/query                                                                  |
| Parameter           | `parameter.ts:1`   | `commerce.types.ts:393`             | `parameter.model.ts:5`                 | ✅           |                                                                                          |
| Promotion           | `promotion.ts:1`   | `commerce.types.ts:132`             | `promotion.model.ts:5`                 | ❌ wiring    | tipo FE sin operación/hook                                                               |
| Reports             | `reporting.ts:74`  | `commerce.types.ts:543`             | `reporting.model.ts:71`                | ✅           |                                                                                          |
| Rider               | `rider.ts:14`      | `delivery.types.ts:32`              | `rider.model.ts:24`                    | ⚠️           | `vehicle` objeto; `status`/`lastSeenAt` no expuestos; nombre/teléfono duplicados de User |
| Trip/TripOrder      | `trip.ts:35,16`    | `delivery.types.ts:116,71`          | `trip.model.ts:33,7`                   | ⚠️           | `riderId` = userId; `TripOrder.order` no existe                                          |
| TripOffer           | `trip.ts:26`       | `delivery.types.ts:95`              | sin modelo                             | ⚠️           | calculada en runtime                                                                     |

## 2. Enums

| Enum                | FE                                           | GraphQL                                      | BE                        | Match                  |
| ------------------- | -------------------------------------------- | -------------------------------------------- | ------------------------- | ---------------------- |
| Role                | `customer, branch_admin, super_admin, rider` | `CUSTOMER, BRANCH_ADMIN, SUPER_ADMIN, RIDER` | lower                     | ✅ (mapeado)           |
| OrderStatus         | PENDING..CANCELLED                           | PENDING..CANCELLED                           | lower                     | ✅                     |
| TripStatus          | OFFERED/ACTIVE/COMPLETED/CANCELLED           | idem                                         | lower                     | ✅                     |
| ConfigGroupType     | `single, multiple`                           | `SINGLE, MULTIPLE`                           | `single, multiple`        | ⚠️ (casing; bug GW-07) |
| VehicleType         | `moto, bici`                                 | `String`                                     | `moto, bici`              | ⚠️ parcial             |
| CartStatus          | `string`                                     | `String`                                     | `active/confirmed`        | ❌ no expuesto         |
| RiderStatus         | ❌                                           | ❌                                           | `offline/free/on_trip`    | ❌ no expuesto         |
| DeliveryOrderStatus | ❌                                           | ❌                                           | `ready/reserved/assigned` | ❌ solo BE             |

## 3. Inconsistencias ordenadas por severidad

1. **ALTA** — `riderId` guarda `userId` (no `Rider._id`): `order.model.ts:100`, `trip.model.ts:35`, `order.controller.ts:119`.
2. **ALTA** — `RecipeItem.optionAdjustments` perdido en GraphQL/FE: `product.model.ts:48-70` vs `commerce.types.ts:84`.
3. **ALTA** — `Rider.vehicle` String (auth) vs objeto (delivery/FE): `user.model.ts:32` vs `rider.model.ts:6`.
4. **MEDIA** — `Order.riderLocation` solo como `@ResolveField` (no declarado).
5. **MEDIA** — fragmentos FE omiten `riderId`/`riderLocation` en listados.
6. **MEDIA** — `Order.addressId`/`tripId` no expuestos.
7. **MEDIA** — `Rider.status`/`lastSeenAt` sin superficie.
8. **MEDIA** — Promotions sin wiring FE.
9. **MEDIA** — OrderStates sin wiring FE.
10. **MEDIA** — `repeatOrder` solo backend.
11. **BAJA** — `Cart.status` sin enum compartido.
12. **BAJA** — Vocabulario `available`/`active`/`status` no unificado.
13. **BAJA** — `User.vehicle` inconsistente entre capas.

## 4. Conceptos sólo-FE / sólo-BE

- **Sólo FE (presentación):** `ProductListLine`, `BranchProduct`, helpers (`isBranchOpenNow`, `ORDER_STATUS_PALETTE`, `groupAttentionOrders`, `tripDeliveryDistanceMeters`, etc.).
- **Sólo BE:** `Zone`, `Shift`, `DeliveryOrder` (roster/rotación), `StockMovement` (sin query).
- **Datos duplicados / relaciones no validadas:** `Rider.firstName/lastName/phone` duplican `User`; `User.branchId` y refs de `Order` sin `ref`/validación FK.

## 5. Recomendaciones

1. Crear un paquete de contratos compartido (codegen) para eliminar las 3 representaciones.
2. Renombrar `riderId`→`riderUserId` o almacenar `Rider._id` de forma consistente.
3. Exponer `optionAdjustments`, `riderId`, `riderLocation`, `status`, `lastSeenAt`, `addressId`, `tripId`.
4. Unificar `Rider.vehicle` y exponer enums (`CartStatus`, `RiderStatus`).
5. Definir y aplicar validación de `branchId` y refs cross-service.
