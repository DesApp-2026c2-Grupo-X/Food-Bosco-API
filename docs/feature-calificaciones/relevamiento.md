# Relevamiento — Sistema de calificaciones

## 1. Arquitectura relevante

Food-Bosco es un monorepo Turborepo con cuatro servicios NestJS:

- `gateway` (4000): único punto GraphQL. Traduce queries/mutations a REST, autentica y compone datos de otros servicios.
- `auth` (4201): usuarios, roles y direcciones.
- `commerce` (4202): catálogo, sucursales, carrito y pedidos.
- `delivery` (4203): repartidores, ofertas, viajes y entregas.

Regla vigente: un servicio primario nunca llama a otro servicio primario. La composición cruzada vive en el gateway o en un orchestrator del mismo servicio.

## 2. Archivos y módulos involucrados

### Backend

- Pedidos: `apps/commerce/src/order/*` (`OrderService`, `OrderRepository`, `OrderController`, `OrderOrchestrator`).
- Sucursales: `apps/commerce/src/branch/*` (`BranchService`).
- Repartidores/viajes: `apps/delivery/src/trip/*`, `apps/delivery/src/rider/*`, `apps/delivery/src/offer/*`.
- Gateway: `apps/gateway/src/graphql/commerce/*`, `apps/gateway/src/graphql/delivery/*` y `apps/gateway/src/rest/*`.
- Autorización: headers `x-user-id`, `x-user-roles`, `x-branch-id` propagados por el gateway e interpretados por cada servicio.

### Frontend

- `apps/store`: experiencia del cliente, detalle e historial de pedidos.
- `apps/branch`: panel de sucursal.
- `apps/admin`: panel global.
- `apps/rider`: panel del repartidor.
- `packages/api`: operaciones GraphQL, hooks Apollo y mappers.
- `packages/domain`: tipos y utilidades compartidas.
- `packages/components`: librería visual basada en Chakra UI y el sistema Calor.

## 3. Modelo actual de pedidos

`orders` (Commerce) guarda, entre otros:

- `clientId`, `branchId`, `addressId`;
- `status` (`pending`, `confirmed`, `preparing`, `ready_for_delivery`, `on_the_way`, `delivered`, `cancelled`);
- `riderId` y `tripId`, asignados cuando un viaje es aceptado;
- `statusHistory`, ítems con snapshot de nombre/precio y totales.

## 4. Relación pedido–sucursal–repartidor

- El pedido se crea con la sucursal asignada por cercanía (`CheckoutOrchestrator`) y ese `branchId` queda persistido.
- Cuando el repartidor acepta un viaje, Delivery publica `trip.accepted`. Commerce consume el evento y hace `markAssigned(orderIds, tripId, riderId)` sobre los pedidos.
- El `riderId` guardado en el pedido es el `userId` del repartidor (mismo identificador que usan los endpoints de Delivery).
- Un viaje puede contener varios pedidos; cada pedido conserva su propio `riderId`.
- La entrega efectiva ocurre cuando el repartidor ejecuta `POST /v1/trips/:tripId/orders/:orderId/deliver`. Delivery actualiza el viaje y hace `PATCH /v1/orders/:orderId/status` con `delivered`; el pedido de Commerce queda en `delivered`.

## 5. Estado exacto de entrega

`Order.status === 'delivered'` es la única condición válida para habilitar la calificación. No se usa el estado del viaje ni la fecha de `deliveredAt` del viaje como fuente principal, porque el contrato del cliente es el pedido.

## 6. Ubicación de la funcionalidad

### Backend

La reseña se persiste en **Commerce**, dentro del dominio `order-review`:

- La reseña es un dato del pedido; el pedido y la sucursal ya viven en Commerce.
- Commerce ya tiene el `riderId` real del pedido (snapshot recibido por evento).
- No se agrega un microservicio nuevo.
- No hay llamadas directas Commerce → Delivery.
- Delivery sigue siendo la fuente de verdad de repartidores; el gateway enriquece nombres con el endpoint interno `GET /v1/riders/by-user/:userId`.

### Frontend

- `apps/store` consume exclusivamente el gateway GraphQL.
- El formulario se muestra desde el detalle de un pedido entregado y desde el historial.
- Las estadísticas se muestran en `apps/branch`, `apps/admin` y `apps/rider` reutilizando un mismo componente visual.

## 7. Contratos GraphQL necesarios

- Mutación `createOrderReview(orderId, input)`.
- Queries `myOrderReviews`, `pendingOrderReviews`, `orderReviewStatus(orderId)`.
- Queries de estadísticas: `branchReviewStats`, `courierReviewStats`, `branchRatingRanking`, `courierRatingRanking`, `reviewsSummary`.
- Campo `Order.rider` para mostrar el nombre del repartidor en la pantalla de calificación.

Detalle completo en `contratos-graphql.md`.

## 8. Componentes frontend reutilizables

- `ResponsiveModal` para la pantalla mobile-first.
- `Card`, `PrimaryButton`, `SecondaryButton`, `TextAreaField`, `Muted`, `Strong`, `Alert` de Chakra.
- `LoadingState` y `EmptyState` para estados de carga/vacío.
- `Toaster` (`notifySuccess`, `notifyError`) para feedback.
- `PageContainer`, `PageHeader`, `SelectField`, `KpiCard` para las pantallas administrativas.
- Iconografía `@gravity-ui/icons` ya instalada (`Star`, `StarFill`, `Person`, `ShoppingBag`).

## 9. Restricciones y riesgos

- El proyecto no tenía un modelo de reseñas; no se reutiliza ningún servicio existente para esta responsabilidad.
- El `riderId` del pedido es un `userId`, no el `_id` del documento `rider`. Cualquier enriquecimiento debe usar el endpoint por `userId`.
- Si Delivery no responde, el nombre del repartidor no se muestra, pero la reseña sigue siendo válida porque se identifica por `riderId`.
- Las estadísticas se calculan con agregaciones MongoDB para evitar N+1.
- La unicidad se garantiza con índice único sobre `orderId`; el servicio además traduce `E11000` a `REVIEW_ALREADY_EXISTS`.
- La documentación previa del plan de rider listaba "calificaciones" como fuera de alcance. Esta feature amplía ese alcance de forma explícita; no se elimina documentación existente.

## 10. Decisiones técnicas justificadas

1. **Commerce es dueño de la reseña**: el pedido es la raíz del caso de uso y ya contiene `branchId` y `riderId`.
2. **Un documento por pedido** (`OrderReview`) con dos bloques independientes (sucursal y repartidor) en lugar de dos colecciones: simplifica la unicidad, la consulta del estado y la actualización del historial.
3. **El frontend no envía `branchId`, `courierId` ni `customerId`**: el backend los deriva del pedido autenticado.
4. **El gateway no calcula promedios**: solo traduce y compone; Commerce devuelve estadísticas agregadas.
5. **Estadísticas separadas**: las agregaciones de sucursal usan `branchRating` y las de repartidor usan `courierRating`; nunca se mezclan.

## 11. Historias de usuario incorporadas

### HU-CAL-01 — Calificar un pedido entregado

**Como** cliente, **quiero** calificar la sucursal y, si hubo delivery, al repartidor de mi pedido entregado, **para** compartir mi experiencia.

Criterios de aceptación:

- Solo se habilita para pedidos propios en estado `delivered`.
- La calificación de sucursal es obligatoria.
- En pedidos con repartidor, la calificación del repartidor también es obligatoria.
- Los comentarios son opcionales, independientes y de hasta 500 caracteres.
- No se permite una segunda reseña sobre el mismo pedido.
- Al enviar, el historial y el detalle reflejan "Pedido calificado".

### HU-CAL-02 — Consultar reputación

**Como** administrador de sucursal, super administrador o repartidor, **quiero** consultar promedios, distribución y comentarios, **para** conocer la reputación de mi sucursal o de mi desempeño.

Criterios de aceptación:

- El administrador de sucursal solo ve su sucursal.
- El super administrador ve rankings de sucursales y repartidores.
- El repartidor solo ve su propia reputación.
- No se exponen datos personales de los clientes que calificaron.
