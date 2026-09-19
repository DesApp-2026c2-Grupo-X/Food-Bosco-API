# Reporte de bugs e inconsistencias detectados por la suite de tests

**Fecha:** 2026-09-19
**Alcance:** apps `auth`, `commerce`, `delivery` y `gateway`.
**Origen:** suite de tests unitarios y de integración construida para validar la lógica de negocio del API.

> Los tests que documentan estos hallazgos se agregaron como regresión de la
> **conducta actual** (marcados con `// KNOWN BUG:`) para no dejar la suite en rojo.
> **No se modificó ninguna regla de negocio.** Cuando el comportamiento correcto es
> inequívoco según `docs/requerimientos-backend-rest.md`, `docs/*/plan.md` o la
> arquitectura existente, el bug queda listado como candidato a corrección.

## Cómo leer este documento

Cada hallazgo indica:

- **Capability** afectada.
- **Escenario** que lo dispara.
- **Comportamiento esperado** (requisito/documentación).
- **Comportamiento actual**.
- **Impacto**.
- **Posible causa**.
- **Test que lo detectó** (archivo + nombre).

**Confiabilidad:** `Alta` = contradice un requisito explícito o rompe un contrato ya
documentado/probado; `Media` = inconsistencia razonable pero con margen de
interpretación; `Baja` = caso latente o deuda menor.

---

## Resumen

| ID      | App      | Capability                                  | Confiabilidad |
| ------- | -------- | ------------------------------------------- | ------------- |
| AUTH-01 | auth     | Envelope de errores HTTP                    | Alta          |
| AUTH-02 | auth     | Correlación por request id                  | Media         |
| AUTH-03 | auth     | Alta de `branch_admin` (validar sucursal)   | Alta          |
| AUTH-04 | auth     | Direcciones: scope de propietario activa    | Media         |
| COM-01  | commerce | Ingredientes: no desactivar en uso          | Media         |
| COM-02  | commerce | Promociones: rango de fechas                | Alta          |
| COM-03  | commerce | Productos: validar categoría                | Alta          |
| COM-04  | commerce | Receta: validar ingrediente                 | Alta          |
| COM-05  | commerce | Receta: 404 al quitar ítem inexistente       | Alta          |
| COM-06  | commerce | Config groups: required/min/max coherentes  | Media         |
| COM-07  | commerce | Receta: cantidades > 0                      | Media         |
| COM-08  | commerce | Opciones: `extraPrice` no negativo          | Media         |
| COM-09  | commerce | Filtro `available` inválido                 | Media         |
| COM-10  | commerce | Ids de subdocumentos                        | Baja          |
| COM-11  | commerce | Horarios que cruzan medianoche              | Media         |
| COM-12  | commerce | Horas de sucursal válidas                   | Media         |
| COM-13  | commerce | Stock: motivo del movimiento                | Alta          |
| COM-14  | commerce | Stock: delta vs cambio real                 | Media         |
| COM-15  | commerce | Parámetros: not found silencioso            | Baja          |
| COM-16  | commerce | Orden: `deliveryAddress` obligatorio        | Alta          |
| COM-17  | commerce | Carrito: identidad del ítem                 | Alta          |
| COM-18  | commerce | Categorías: nombre duplicado                | Baja          |
| DLV-01  | delivery | Onboarding: conservar vehículo de Auth      | Alta          |
| DLV-02  | delivery | Perfil: `phone` requerido                   | Alta          |
| DLV-03  | delivery | Eventos: idempotencia por `eventId`         | Alta          |
| DLV-04  | delivery | Reconexión del transporte RabbitMQ          | Media         |
| GW-01   | gateway  | DataLoader: dedupe de keys (N+1)            | Alta          |
| GW-02   | gateway  | RestClient: respuestas 2xx sin cuerpo       | Media         |
| GW-03   | gateway  | Mapeo de direcciones: lat/lng faltantes     | Baja          |
| GW-04   | gateway  | Formato de errores: propagar `path` REST    | Media         |
| GW-05   | gateway  | Upload: propagar `path` downstream          | Baja          |
| GW-06   | gateway  | `TripOrder.order` ausente del esquema       | Media         |
| GW-07   | gateway  | `ConfigGroupType` con casing incorrecto     | Alta          |

---

## Auth

### AUTH-01 — Un `HttpException` 409 se reporta como `INTERNAL_SERVER_ERROR`

- **Capability:** envelope de error único (`{ code, message, path }`, RQ-REST-07 / NFR-05).
- **Escenario:** cualquier `ConflictException` (409) u otra `HttpException` fuera de 400/401/403/404 llega al filtro.
- **Esperado:** `code` coherente con el status 409 (p. ej. `CONFLICT`/dominio).
- **Actual:** HTTP 409 pero `body.code = "INTERNAL_SERVER_ERROR"`.
- **Impacto:** clientes y gateway que ramifican por `code` interpretan un conflicto de negocio como falla de servidor.
- **Posible causa:** `codeForStatus` (`apps/auth/src/config/exceptions/http-exception.filter.ts:8-14`) devuelve `ERROR_CODES.internal` por defecto.
- **Test:** `src/config/exceptions/http-exception.filter.spec.ts` › *KNOWN BUG: un HttpException 409 (Conflict) se etiqueta como INTERNAL_SERVER_ERROR*.
- **Confiabilidad:** Alta.

### AUTH-02 — Un `x-request-id` vacío no se regenera

- **Capability:** correlación de trazas (NFR-03).
- **Escenario:** request con header `X-Request-Id:` vacío.
- **Esperado:** generar un UUID como cuando el header falta.
- **Actual:** conserva `''` y lo propaga en request y response.
- **Impacto:** se pierde la correlación de logs/trazas para esos requests.
- **Posible causa:** `request-id.middleware.ts:9-10` usa `incoming ?? randomUUID()`, que no cubre string vacío.
- **Test:** `src/config/observability/request-id.middleware.spec.ts` › *KNOWN BUG: un x-request-id vacío se conserva en vez de generar uno nuevo*.
- **Confiabilidad:** Media.

### AUTH-03 — `createStaff` no valida la sucursal contra Commerce

- **Capability:** alta de `branch_admin` (RQ-AUTH-13).
- **Escenario:** `POST /v1/users/staff` con `branchId: 'no-existe'` o vacío.
- **Esperado:** validar la sucursal contra Commerce Service vía REST y rechazar si no existe.
- **Actual:** el `branchId` se persiste tal cual; no existe llamada a Commerce en `apps/auth`.
- **Impacto:** colaboradores vinculados a sucursales inexistentes.
- **Posible causa:** `UserController.createStaff` delega en `createUser` sin validación (`user.controller.ts:58`).
- **Test:** `src/user/user.service.spec.ts` › *acepta cualquier branchId sin validarlo contra Commerce (KNOWN BUG: RQ-AUTH-13)*.
- **Confiabilidad:** Alta (requisito explícito). Nota: podría diferirse deliberadamente al gateway.

### AUTH-04 — `AddressRepository.updateOwned` no filtra por `active`

- **Capability:** direcciones del cliente con scope de propietario.
- **Escenario:** `PATCH /v1/addresses/{id}` sobre una dirección soft-deleted (`active:false`).
- **Esperado:** tratarla como no encontrada (consistente con `listByUser`/`findOwnedById`).
- **Actual:** la query es `{_id, userId}` sin `active:true`, por lo que la actualiza y la devuelve.
- **Impacto:** una dirección eliminada puede mutarse; luego sigue oculta en el listado (inconsistencia).
- **Posible causa:** `address.repository.ts:45` omite `active: true`.
- **Test:** `src/address/address.repository.spec.ts` › *permite actualizar una dirección desactivada porque no filtra por active (KNOWN BUG)*.
- **Confiabilidad:** Media.

---

## Commerce

### COM-01 — `INGREDIENT_IN_USE` nunca se aplica al desactivar un ingrediente

- **Capability:** (des)activar ingredientes usados en recetas (RQ-CAT-10/11).
- **Escenario:** `PATCH /v1/catalog/ingredients/{id}/active { active:false }` sobre un ingrediente referenciado por la receta de un producto activo.
- **Esperado:** rechazar con `code: INGREDIENT_IN_USE` (el código existe en `constants.ts:90`).
- **Actual:** se desactiva siempre; `ERROR_CODES.ingredientInUse` no se referencia en ningún archivo.
- **Impacto:** recetas/stock pueden referenciar ingredientes inactivos; inconsistencias de catálogo.
- **Posible causa:** la regla requiere datos de recetas (otro dominio) y no se construyó el orchestrator que los coordine.
- **Test:** `src/ingredient/ingredient.service.spec.ts` › *desactiva un ingrediente en uso porque la validación no existe (comportamiento actual)*.
- **Confiabilidad:** Media (la redacción de RQ-CAT-10 admite solo desactivar).

### COM-02 — No se valida `startDate <= endDate` en promociones

- **Capability:** promociones como dato general (RQ-CAT-13).
- **Escenario:** crear/actualizar promoción con `startDate` posterior a `endDate`.
- **Esperado:** rechazar (400/error de dominio).
- **Actual:** se persiste tal cual.
- **Impacto:** promociones que terminan antes de comenzar.
- **Posible causa:** el DTO solo aplica `@IsDateString`; el servicio no compara fechas.
- **Test:** `src/promotion/promotion.service.spec.ts` › *PromotionService.create — validación de rango de fechas (KNOWN BUG)*.
- **Confiabilidad:** Alta.

### COM-03 — No se valida la categoría al crear/actualizar producto

- **Capability:** alta/edición de producto (RQ-CAT-04).
- **Escenario:** `create({ categoryId: 'missing', ... })`.
- **Esperado:** 404 `CATEGORY_NOT_FOUND`.
- **Actual:** el producto se crea; `CATEGORY_NOT_FOUND` no se emite en el módulo product.
- **Impacto:** productos huérfanos.
- **Posible causa:** `ProductService` solo inyecta `ProductRepository`; no consulta categorías.
- **Test:** `src/product/product.service.spec.ts` › *KNOWN BUG: crea un producto con categoría inexistente sin lanzar CATEGORY_NOT_FOUND*.
- **Confiabilidad:** Alta.

### COM-04 — No se valida el ingrediente al armar la receta

- **Capability:** receta del producto (RQ-CAT-11).
- **Escenario:** `setRecipe`/`addRecipeItem`/`updateRecipeItem` con `ingredientId` inexistente.
- **Esperado:** 404 `INGREDIENT_NOT_FOUND`.
- **Actual:** se guarda tal cual.
- **Impacto:** recetas, reportes y descuentos de stock referencian ingredientes inexistentes.
- **Posible causa:** `ProductService` no inyecta ingredientes.
- **Test:** `src/product/product.service.spec.ts` › *KNOWN BUG: setRecipe acepta ingredientes inexistentes sin lanzar INGREDIENT_NOT_FOUND*.
- **Confiabilidad:** Alta.

### COM-05 — Quitar un ítem de receta inexistente devuelve 200

- **Capability:** quitar ingrediente de la receta (RQ-CAT-11).
- **Escenario:** `DELETE /v1/catalog/products/{id}/recipe/items/{itemId}` con `itemId` inexistente.
- **Esperado:** 404 `RECIPE_ITEM_NOT_FOUND`.
- **Actual:** el repositorio guarda y responde 200 con el producto.
- **Impacto:** el cliente cree haber borrado algo que no existía; se pierde la señal de idempotencia.
- **Posible causa:** `ProductRepository.removeRecipeItem` no verifica longitud (a diferencia de `removeConfigGroup/Option`).
- **Test:** `src/product/product.repository.spec.ts` y `src/product/product.controller.spec.ts` › *KNOWN BUG: removeRecipeItem de un ítem inexistente…*.
- **Confiabilidad:** Alta.

### COM-06 — Grupos de configuración inconsistentes (`required`/`min`/`max`)

- **Capability:** definición coherente de grupos (RQ-CAT-07).
- **Escenario:** `required:true` sin `min`; `min > max`.
- **Esperado:** 400 `VALIDATION_ERROR`.
- **Actual:** se acepta.
- **Impacto:** grupos insatisfacibles o rangos invertidos en el cliente.
- **Posible causa:** validación de campos individuales, sin validador cruzado ni regla de servicio.
- **Test:** `src/product/product.service.spec.ts` y `src/product/dto/product.dto.spec.ts` › *KNOWN BUG: acepta un grupo inconsistente*.
- **Confiabilidad:** Media.

### COM-07 — Cantidades de receta `0`/negativas

- **Capability:** cantidades de ingredientes (RQ-CAT-11/12).
- **Escenario:** `quantity: 0` (DTO/servicio) o negativa vía servicio.
- **Esperado:** cantidad `> 0`.
- **Actual:** `@Min(0)` acepta 0; sin guarda de servicio/repositorio.
- **Impacto:** requerimientos de stock nulos/negativos en `accumulateRequirements`.
- **Test:** `src/product/product.service.spec.ts` y `src/product/dto/product.dto.spec.ts` › *KNOWN BUG: acepta cantidad 0/no positiva*.
- **Confiabilidad:** Media.

### COM-08 — `extraPrice` negativo en opciones de configuración

- **Capability:** variación `+$` de opciones (RQ-CAT-08).
- **Escenario:** `extraPrice: -10`.
- **Esperado:** rechazar / no negativo.
- **Actual:** se acepta (sin `@Min`).
- **Impacto:** opciones que reducen precio sin motor de promociones.
- **Test:** `src/product/dto/product.dto.spec.ts` › *KNOWN BUG: acepta extraPrice negativo*.
- **Confiabilidad:** Media.

### COM-09 — El filtro `available` inválido se coacciona a `false`

- **Capability:** filtros de catálogo (RQ-CAT-05).
- **Escenario:** `GET /v1/catalog/products?available=garbage`.
- **Esperado:** 400 de validación.
- **Actual:** se coacciona a `false` y devuelve 200 con solo no disponibles.
- **Impacto:** un request malformado oculta silenciosamente el catálogo.
- **Posible causa:** `@Transform(({ value }) => value === 'true' || value === true)` sin rechazo.
- **Test:** `src/product/dto/product.dto.spec.ts` › *KNOWN BUG: available con valor inválido se coacciona a false sin error*.
- **Confiabilidad:** Media.

### COM-10 — `id` de subdocumento queda `''` cuando falta `_id`

- **Capability:** serialización de subdocumentos.
- **Escenario:** opción/grupo sin `_id`.
- **Esperado:** identificador válido o error.
- **Actual:** `subId` cae a `''`.
- **Impacto:** colisiones de ids en respuestas.
- **Test:** `src/product/product.model.spec.ts` › *KNOWN BUG: sin _id devuelve id vacío…*.
- **Confiabilidad:** Baja.

### COM-11 — Horarios que cruzan medianoche no se soportan

- **Capability:** `isBranchOpenNow` / `findAvailable` (RQ-BRN-03).
- **Escenario:** horario `22:00→02:00` evaluado 23:00 y 01:00.
- **Esperado:** abierto.
- **Actual:** `false` (la condición `current >= opening && current < closing` da intervalo vacío).
- **Impacto:** sucursales nocturnas siempre “cerradas” → excluidas de la asignación → falla la confirmación.
- **Test:** `src/branch/branch.model.spec.ts` › *isBranchOpenNow — rango nocturno…*
- **Confiabilidad:** Media (no exigido explícitamente por RQ-BRN-03).

### COM-12 — El DTO de horas no valida rangos válidos

- **Capability:** horarios de sucursal (RQ-BRN-03).
- **Escenario:** `'99:99'`, `'25:00'`, `'08:99'`.
- **Esperado:** rechazar.
- **Actual:** acepta formato `\d{2}:\d{2}` sin validar 00–23 / 00–59; `'08:99'` se interpreta como 09:39.
- **Impacto:** ventanas de atención corruptas.
- **Test:** `src/branch/dto/branch-dtos.spec.ts` › *acepta la hora fuera de rango*.
- **Confiabilidad:** Media.

### COM-13 — El motivo del ajuste de stock se descarta

- **Capability:** movimientos de stock (RQ-STK-04).
- **Escenario:** `POST /v1/stock/adjustments` (y `AdjustStockInput.reason`, requerido en GraphQL) con un motivo.
- **Esperado:** el movimiento registra el motivo recibido.
- **Actual:** siempre `'adjust'`.
- **Impacto:** se pierde la trazabilidad del motivo; se viola el contrato GraphQL.
- **Posible causa:** `stock.controller.ts:33` no reenvía `dto.reason` y `stock.service.ts` no recibe el motivo.
- **Test:** reportado (el controller quedaba fuera del alcance del agente; ver auditoría de stock).
- **Confiabilidad:** Alta.

### COM-14 — `delta` del movimiento no coincide con el cambio real

- **Capability:** consistencia de `stockMovements` (RQ-STK-04/08).
- **Escenario:** `discount(b1,{i1:5})` con stock 2, o `adjust(...,-10)` con stock 2.
- **Esperado:** `delta` = cambio aplicado (−2).
- **Actual:** `delta` = solicitado (−5/−10) mientras `branchStock` se recorta a 0.
- **Impacto:** el historial no concilia con `branchStock`.
- **Posible causa:** `stock.service.ts:74` registra `-required` y `:31` el `delta` crudo sin recalcular.
- **Test:** `src/stock/stock.service.spec.ts` › *registra el delta solicitado aunque no coincida con el recorte real*.
- **Confiabilidad:** Media.

### COM-15 — `ParameterService.update` con fallback silencioso

- **Capability:** parámetros del sistema.
- **Escenario:** el repositorio devuelve `null`.
- **Esperado:** `PARAMETER_NOT_FOUND`.
- **Actual:** devuelve `{ key, value, unit: '' }`.
- **Impacto:** `parameterNotFound`/`invalidParameterValue` quedan muertos; se filtra una unidad falsa.
- **Posible causa:** `parameter.service.ts:39` (el repositorio usa `upsert`, rara vez se alcanza).
- **Test:** `src/parameter/parameter.service.spec.ts` › *ante ausencia de documento devuelve unit vacío…*
- **Confiabilidad:** Baja.

### COM-16 — `deliveryAddress` faltante en confirmar pedido → 500

- **Capability:** confirmar pedido (RQ-ORD-02/05).
- **Escenario:** cliente con carrito activo envía `{ "addressId": "addr-1" }` sin `deliveryAddress`.
- **Esperado:** 400 de validación.
- **Actual:** pasa el `ValidationPipe`; el orchestrator accede a `undefined.latitude` → `TypeError` → 500 `INTERNAL_SERVER_ERROR`.
- **Impacto:** payloads malformados se ven como errores de servidor.
- **Posible causa:** `deliveryAddress` con `@ValidateNested`/`@Type` pero sin `@IsNotEmpty`; `@ValidateNested` omite `undefined`.
- **Test:** `src/order/dto/order-dtos.spec.ts` y `test/order-flow.e2e-spec.ts` › *KNOWN BUG: sin deliveryAddress responde 500 en lugar de 400*.
- **Confiabilidad:** Alta.

### COM-17 — El `id` del ítem del carrito cambia en cada mutación

- **Capability:** actualizar/quitar ítems (RQ-CART-04/05).
- **Escenario:** agregar ítem (id `X`), `PATCH .../X { quantity:2 }`; el ítem devuelto tiene nuevo id `Y`; un `PATCH .../X` posterior da 404.
- **Esperado:** id estable por ítem.
- **Actual:** `setItemsAndTotal` hace `$set:{items}`, Mongo regenera `_id` de cada subdocumento.
- **Impacto:** los clientes deben releer el id tras cada cambio; tablas/races rompen.
- **Test:** `test/order-flow.e2e-spec.ts` › *KNOWN BUG: el id del ítem cambia tras una actualización*.
- **Confiabilidad:** Alta.

### COM-18 — Categorías: nombre duplicado sin manejo

- **Capability:** unicidad de categorías.
- **Escenario:** crear categoría con un nombre ya usado.
- **Esperado (según consigna):** error de dominio.
- **Actual:** no hay índice único ni chequeo; puede propagarse un `E11000` crudo.
- **Impacto:** categorías duplicadas.
- **Test:** `src/category/category.repository.spec.ts` › *propaga el error crudo de Mongo ante un nombre duplicado*.
- **Confiabilidad:** Baja (los requisitos no exigen unicidad explícita).

---

## Delivery

### DLV-01 — El onboarding lazy descarta el vehículo de Auth (pérdida de datos)

- **Capability:** onboarding del rider (`GET /v1/riders/me`, RQ-DLV-11 / plan.md §2.6).
- **Escenario:** rider existente en Auth con `vehicle: "Moto"`; primer `GET /v1/riders/me`.
- **Esperado:** persistir el vehículo de Auth (el plan indica snapshot de `firstName/lastName/vehicle/phone`).
- **Actual:** `RiderOrchestrator.ensureProfile` llama a `create({ ..., vehicle: null })` (`rider.orchestrator.ts:79`).
- **Impacto:** todo rider onboardeado lazy queda sin vehículo hasta un `PATCH /v1/riders/me/vehicle`; se pierde el dato.
- **Contexto:** el commit #8 migró `vehicle` de `string` a objeto estructurado `{ type, brand?, model?, plate? }` y agregó `/me/vehicle`, pero no actualizó el onboarding ni el e2e. El tipo de Auth sigue siendo `string`, por lo que no hay mapeo directo.
- **Test:** `src/rider/rider.orchestrator.spec.ts` › *ignora el vehículo de Auth al crear el rider (KNOWN BUG)*. El e2e `test/app.e2e-spec.ts` fue actualizado a la conducta vigente (vehículo `null` + alta por `/me/vehicle`).
- **Confiabilidad:** Alta (inconsistencia de diseño introducida en #8).

### DLV-02 — `phone: null` en el perfil omite la validación y anula un requerido

- **Capability:** perfil del rider (RQ-DLV-11).
- **Escenario:** `PATCH /v1/riders/me` con `{ "phone": null }`.
- **Esperado:** 400 `VALIDATION_ERROR` (el schema marca `phone` requerido).
- **Actual:** `@IsOptional()` omite `null`/`undefined`; `updateProfile` hace `$set:{phone:null}` (sin `runValidators`).
- **Impacto:** pérdida de integridad; `serializeRider` devuelve `phone:null` pese a `PublicRider.phone: string`.
- **Posible causa:** `update-rider-profile.dto.ts:4-7` usa `@IsOptional()`.
- **Test:** `src/rider/dto/update-rider-profile.dto.spec.ts` › *phone null pasa la validación (KNOWN BUG)*.
- **Confiabilidad:** Alta.

### DLV-03 — El consumo de eventos no es idempotente por `eventId`

- **Capability:** idempotencia de `order.status_changed` (RQ-COM-05 / RQ-DLV-03).
- **Escenario:** el mismo evento (`eventId`) llega dos veces, o un `READY_FOR_DELIVERY` se repite tras reservar/asignar.
- **Esperado:** no duplicar efectos; una orden reservada/asignada no debe volver al pool.
- **Actual:** `handleOrderStatusChanged` llama a `upsertReady` siempre; `$set { status:'ready', tripId:null, reservedUntil:null }` reintegra la orden reservada.
- **Impacto:** una orden ya en un viaje puede ofrecerse/aceptarse por otro rider → doble asignación.
- **Posible causa:** no hay store de dedupe por `eventId`; el upsert está keyed solo por `orderId`.
- **Test:** `src/delivery-order/delivery-order.service.spec.ts` › *KNOWN BUG: no deduplica por eventId…*.
- **Confiabilidad:** Alta.

### DLV-04 — El transporte RabbitMQ no reconecta tras `close()`

- **Capability:** ciclo de vida del transporte de eventos.
- **Escenario:** `publish` → `close()` → `publish`.
- **Esperado:** reconectar o fallar explícitamente.
- **Actual:** `close()` anula `channel`/`connection` pero no `connectPromise`; el siguiente `publish` reusa la promesa resuelta y publica sobre el canal cerrado.
- **Impacto:** eventos perdidos/errores tras reapertura; sin recuperación.
- **Test:** `src/config/messaging/rabbit.transport.spec.ts` › *KNOWN BUG: no reconecta tras close()…*.
- **Confiabilidad:** Media.

---

## Gateway

### GW-01 — El DataLoader no deduplica keys (N+1)

- **Capability:** batching y dedupe de resoluciones cross-service (RQ-GW-09).
- **Escenario:** dos parents referencian el mismo id en el mismo tick (`Order.client` repetido, dos productos de la misma categoría).
- **Esperado:** una llamada REST por id único por lote.
- **Actual:** una llamada por parent.
- **Impacto:** el N+1 persiste para ids repetidos; carga extra sobre Auth/Commerce.
- **Posible causa:** `rest/data-loader.ts` y `commerce.dataloaders.ts` no mantienen caché por key.
- **Test:** `src/rest/data-loader.spec.ts`, `src/graphql/commerce/commerce.dataloaders.spec.ts`, `test/graphql-dataloader.e2e-spec.ts` › *No deduplica keys repetidas dentro del mismo lote*.
- **Confiabilidad:** Alta.

### GW-02 — El RestClient no maneja respuestas 2xx sin cuerpo

- **Capability:** cliente REST genérico.
- **Escenario:** respuesta 2xx con body vacío (p. ej. 204).
- **Esperado:** resolver `undefined`/vacío.
- **Actual:** `response.json()` rechaza con `SyntaxError` crudo.
- **Impacto:** latente: cualquier endpoint 204 rompería el gateway.
- **Posible causa:** `request()` siempre parsea JSON; solo `postMultipart` está exceptuado.
- **Test:** `src/rest/rest.client.spec.ts` › *204 con cuerpo vacío: response.json() rechaza…*.
- **Confiabilidad:** Media.

### GW-03 — `mapAddress` produce `NaN` con lat/lng faltantes

- **Capability:** mapeo defensivo de direcciones.
- **Escenario:** dirección sin `latitude`/`longitude`.
- **Esperado:** default seguro (como `asNumber`) o error de dominio.
- **Actual:** `Number(undefined) → NaN`, que GraphQL `Float` no puede serializar.
- **Impacto:** latente ante datos upstream malformados.
- **Test:** `src/graphql/auth/auth.types.spec.ts` › *lat/lng ausentes producen NaN*.
- **Confiabilidad:** Baja.

### GW-04 — El formatter de GraphQL descarta el `path` REST del downstream

- **Capability:** envelope único de errores (RQ-GW-07).
- **Escenario:** downstream 409 `{code,message,path:'/v1/orders/o1'}`.
- **Esperado:** `errors[].path` conserva el path del servicio.
- **Actual:** `errors[].path` es el path GraphQL (`['order']`) y `extensions` solo `{code}`.
- **Impacto:** se pierde trazabilidad del error original.
- **Posible causa:** `formatGraphQLError` devuelve `path: formattedError.path` y solo conserva `code`.
- **Test:** `test/graphql-errors.e2e-spec.ts` › *HTTP 409 → errors[] con ORDER_STATE_CONFLICT*.
- **Confiabilidad:** Media (interpretación de RQ-GW-07).

### GW-05 — El filtro de upload descarta el `path` downstream

- **Capability:** envelope único de errores en upload.
- **Escenario:** Commerce devuelve envelope con `path:'/v1/catalog/uploads'`.
- **Esperado:** propagarlo.
- **Actual:** siempre usa la URL del gateway `/v1/uploads`.
- **Test:** `test/gateway-upload.e2e-spec.ts` › *propaga error downstream 409 → DUPLICATE_IMAGE*.
- **Confiabilidad:** Baja.

### GW-06 — `TripOrder.order` no existe en el esquema GraphQL

- **Capability:** unión cross-service `TripOrder.order` (RQ-GW-08/09, doc §4).
- **Escenario:** `trip(id:"t1"){ orders { order { id } } }`.
- **Esperado:** resolver Order vía Commerce/DataLoader.
- **Actual:** 400 `GRAPHQL_VALIDATION_FAILED` — *Cannot query field "order" on type "TripOrder"*.
- **Impacto:** falta una capacidad documentada (dependiente del dominio Commerce, D8).
- **Test:** `test/graphql-dataloader.e2e-spec.ts` › *TripOrder.order todavía no existe en el esquema*.
- **Confiabilidad:** Media (gap documentado como pendiente).

### GW-07 — `ConfigGroupType` se envía a REST con casing incorrecto (rompe el flujo real)

- **Capability:** crear/actualizar grupos de configuración vía gateway (RQ-CAT-07).
- **Escenario:** `createConfigGroup(type: MULTIPLE)` / `updateConfigGroup(type: SINGLE)`.
- **Esperado:** `type: 'multiple' | 'single'` (Commerce usa `@IsIn(['single','multiple'])`).
- **Actual:** el gateway envía `'MULTIPLE'`/`'SINGLE'`; con Commerce real devolvería 400.
- **Impacto:** create/update de config groups roto end-to-end.
- **Posible causa:** los resolvers pasan el input crudo; `configGroupTypeToRest` existe pero nunca se invoca (a diferencia de `orderStatusToRest`/`roleToRest`).
- **Test:** `test/graphql-commerce.e2e-spec.ts` › *createConfigGroup → POST /v1/catalog/products/p1/configurations*.
- **Confiabilidad:** Alta.

---

## Hallazgos descartados o de baja confianza

- **`stockNotFound` / `parameterNotFound` / `invalidParameterValue` son códigos muertos** (no se lanzan en ningún camino alcanzable). Deuda menor.
- **`durationToMs` con valor inválido devuelve `0`** (fail-closed, los tokens expiran de inmediato). Se fijó como conducta actual, no como bug.
- **`super_admin` no satisface roles de `branch_admin`** (sin escalada implícita). Comportamiento actual; RQ-SEC no lo especifica.
- **`requestPasswordRecovery` genera token para usuarios inactivos** (no pueden loguear igual). Fijado, no marcado.
- **Header `X-Roles` vs `x-user-roles`**: la doc (§5, RQ-SEC-03) menciona `X-Roles`, pero la implementación y los 3 servicios usan `x-user-roles`. La inconsistencia está en la documentación, no en el código.
- **Duplicados de ingredientes en receta** no se deduplican; RQ-CAT-11 no lo prohíbe.
- **`ReportingService.outOfStock` emite `quantity: 0`** incluso con stock negativo; semántica ambigua.
- **`DeliveryOrder` GET de un ítem inexistente** en `removeRecipeItem` (COM-05) ya cubierto.

---

## Recomendación de priorización

1. **Rompe flujo end-to-end:** GW-07, COM-16, COM-17, DLV-03, DLV-01.
2. **Integridad de datos:** AUTH-03, COM-01, COM-04, COM-13, DLV-02.
3. **Contratos/validaciones:** COM-02, COM-03, COM-05, AUTH-01, GW-01.
4. **Robustez/latentes:** el resto.
