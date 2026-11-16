# Informe de implementación — Calificaciones

## 1. Resumen ejecutivo

Se implementó el flujo completo de calificaciones de sucursal y repartidor:

- El cliente califica pedidos propios en estado `delivered`.
- La sucursal es obligatoria; el repartidor es obligatorio cuando el pedido tuvo delivery.
- Una única reseña por pedido, garantizada por índice único y validación de servicio.
- El backend deriva `branchId`, `riderId` y `customerId` del pedido, nunca del input.
- El gateway expone contratos GraphQL y compone el nombre del repartidor desde Delivery.
- Store muestra la acción en detalle e historial y actualiza el estado después de calificar.
- Branch, admin y rider disponen de vistas de reputación.

## 2. Arquitectura implementada

- **Commerce** incorpora el dominio `order-review` con controller → orchestrator → servicio primario → repositorio.
- **Gateway** agrega `ReviewsResolver` y resolvers de composición.
- **Delivery** no se modifica; sigue siendo fuente de verdad de repartidores.
- **Frontend** consume exclusivamente GraphQL a través de `packages/api`.

No se agregaron microservicios ni llamadas directas Commerce → Delivery.

## 3. Archivos creados

### Backend

- `apps/commerce/src/order-review/order-review.model.ts`
- `apps/commerce/src/order-review/order-review.repository.ts`
- `apps/commerce/src/order-review/order-review.service.ts`
- `apps/commerce/src/order-review/order-review.orchestrator.ts`
- `apps/commerce/src/order-review/order-review.controller.ts`
- `apps/commerce/src/order-review/order-review.module.ts`
- `apps/commerce/src/order-review/dto/create-order-review.dto.ts`
- `apps/commerce/src/order-review/dto/review-query.dto.ts`
- `apps/commerce/src/order-review/dto/order-review-dtos.spec.ts`
- `apps/commerce/src/order-review/order-review.service.spec.ts`
- `apps/commerce/src/order-review/order-review.orchestrator.spec.ts`
- `apps/gateway/src/graphql/commerce/reviews.types.ts`
- `apps/gateway/src/graphql/commerce/reviews.inputs.ts`
- `apps/gateway/src/graphql/commerce/reviews.resolver.ts`

### Frontend

- `packages/domain/src/review.ts`
- `packages/api/src/client/reviews.ts`
- `packages/api/src/hooks/useOrderReviews.ts`
- `packages/components/src/StarRating/index.tsx`
- `packages/components/src/StarRating/types.ts`
- `packages/components/src/ReviewStatsPanel/index.tsx`
- `packages/components/src/ReviewStatsPanel/types.ts`
- `packages/components/src/__tests__/star-rating.test.tsx`
- `apps/store/src/components/ReviewOrderModal/index.tsx`
- `apps/store/src/components/ReviewOrderModal/types.ts`
- `apps/store/src/components/ReviewOrderModal/__tests__/ReviewOrderModal.test.tsx`
- `apps/branch/src/pages/RatingsPage/index.tsx`
- `apps/admin/src/pages/RatingsPage/index.tsx`

### Documentación

- `docs/feature-calificaciones/relevamiento.md`
- `docs/feature-calificaciones/diseno-tecnico.md`
- `docs/feature-calificaciones/modelo-datos.md`
- `docs/feature-calificaciones/contratos-graphql.md`
- `docs/feature-calificaciones/integracion-frontend.md`
- `docs/feature-calificaciones/casos-de-prueba.md`
- `docs/feature-calificaciones/informe-implementacion.md`

## 4. Archivos modificados

### Backend

- `apps/commerce/src/config/constants.ts` (códigos de error).
- `apps/commerce/src/config/validation/validation.pipe.ts` (etiquetas de campos).
- `apps/commerce/src/app.module.ts` (registro del módulo).
- `apps/gateway/src/graphql/commerce/commerce.types.ts` (`OrderCourier`, `Order.rider`).
- `apps/gateway/src/graphql/commerce/commerce.fields.resolver.ts` (resolver `Order.rider`).
- `apps/gateway/src/graphql/commerce/commerce.module.ts` (providers).

### Frontend

- `packages/domain/src/index.ts`
- `packages/api/src/index.ts`
- `packages/api/src/client/store.ts` (mapeo de `rider` en el detalle).
- `packages/api/src/utils/errorMessage.ts` (mensajes de los códigos nuevos).
- `packages/components/src/index.ts`
- `apps/store/src/pages/OrderDetailPage/index.tsx`
- `apps/store/src/pages/OrdersPage/index.tsx`
- `apps/store/src/pages/OrderDetailPage/__tests__/OrderDetailPage.test.tsx`
- `apps/store/src/pages/OrdersPage/__tests__/OrdersPage.test.tsx`
- `apps/store/src/pages/__tests__/smoke.test.tsx`
- `apps/branch/src/routes.ts`, `App.tsx`, `layouts/BranchLayout/utils/navigation.ts`
- `apps/admin/src/routes.ts`, `App.tsx`, `layouts/AdminLayout/utils/navigation.ts`
- `apps/rider/src/pages/ProfilePage/index.tsx`

## 5. Modelos y colecciones

- Colección `orderReviews`.
- Documento único por pedido con bloques independientes de sucursal y repartidor.
- Índices: único `orderId`; `customerId`; `branchId + createdAt`; `courierId + createdAt`.

## 6. Operaciones GraphQL

- `createOrderReview`
- `myOrderReviews`
- `pendingOrderReviews`
- `orderReviewStatus`
- `branchReviewStats`
- `courierReviewStats`
- `branchRatingRanking`
- `courierRatingRanking`
- `reviewsSummary`

## 7. Endpoints REST internos

- `POST /v1/reviews/orders/:orderId`
- `GET /v1/reviews/orders/:orderId`
- `GET /v1/reviews/mine`
- `GET /v1/reviews/pending`
- `GET /v1/reviews/branches/:branchId/stats`
- `GET /v1/reviews/couriers/:courierId/stats`
- `GET /v1/reviews/branches/ranking`
- `GET /v1/reviews/couriers/ranking`
- `GET /v1/reviews/summary`

## 8. Reglas de negocio

- Solo pedidos propios.
- Solo pedidos `delivered`.
- Sucursal obligatoria.
- Repartidor obligatorio si el pedido tiene `riderId`.
- Sin datos de repartidor en pedidos sin delivery.
- Una reseña por pedido.
- Puntajes enteros 1..5.
- Comentarios opcionales de hasta 500 caracteres.
- Sucursal y repartidor se copian del pedido.
- Estadísticas separadas por actor.

## 9. Validaciones y permisos

- DTO con `class-validator`.
- Validación defensiva en el servicio.
- Índice único y traducción de `E11000`.
- `customer`: crear y consultar sus reseñas.
- `branch_admin`: solo su sucursal.
- `super_admin`: rankings y resumen global.
- `rider`: solo su propia reputación.
- El gateway y el servicio REST validan roles y alcance.

## 10. Componentes frontend

- `StarRating` interactivo y de lectura, accesible por teclado.
- `ReviewOrderModal` mobile-first con dos bloques independientes.
- `ReviewStatsPanel` reutilizable para branch, admin y rider.
- Páginas `RatingsPage` en branch y admin.
- Tarjeta de reputación en el perfil del rider.

## 11. Estadísticas implementadas

- Promedio y total por sucursal y por repartidor.
- Distribución 1..5.
- Comentarios recientes.
- Ranking de sucursales y repartidores.
- Resumen global.
- Filtros por período (`from`, `to`) y límite de comentarios.

## 12. Pruebas ejecutadas y resultados

| Suite | Resultado |
| --- | --- |
| Commerce completa (Jest) | 70 suites, 1587 tests aprobados |
| Gateway completa (Jest) | 33 suites, 655 tests aprobados |
| Store completo (Vitest) | 44 archivos, 218 tests aprobados |
| Rider completo (Vitest) | 30 archivos, 141 tests aprobados |
| Branch completo (Vitest) | 17 archivos, 74 tests aprobados |
| Admin: `product-editor-flow` | 2 tests aprobados |
| Admin: `staff-flow` | 1 test aprobado |
| StarRating | 4 tests aprobados |
| ReviewOrderModal | 8 tests aprobados |
| OrderDetailPage / OrdersPage | 21 tests aprobados |

Nota: la suite completa de Admin no se completó dentro del tiempo límite de la sesión; los dos flujos afectados por la ejecución en paralelo se volvieron a ejecutar de forma individual y aprobaron.

## 13. Builds ejecutados

- API: `npm run build` → 5 tareas exitosas (gateway, commerce, auth, delivery, seed-utils).
- Frontend: `npm run build` → 10 tareas exitosas (admin, store, branch, rider, api, domain, components, auth, theme, vite-config).
- Lint API: exitoso.
- Lint Frontend: exitoso.

## 14. Documentación actualizada

- Carpeta `docs/feature-calificaciones/` completa.
- Historias de usuario HU-CAL-01 y HU-CAL-02 en el relevamiento.
- Contratos GraphQL y REST documentados.
- Decisiones de arquitectura y discrepancias documentadas.

## 15. Decisiones técnicas

1. Reseña persistida en Commerce por ser un dato del pedido.
2. Un solo documento por pedido con dos bloques independientes.
3. `riderId` tomado del snapshot del pedido; nombre resuelto en el gateway.
4. Agregaciones MongoDB para estadísticas, sin N+1.
5. Frontend sin mocks ni llamadas REST directas.
6. Reutilización de componentes Calor existentes.

## 16. Limitaciones y pendientes

### Implementado y probado

- Flujo de creación, validaciones, permisos, duplicados y estados.
- Estadísticas y rankings.
- Pantalla de calificación, historial y detalle.
- Vistas de branch, admin y rider.

### Implementado pero no probado de punta a punta

- Flujo E2E real con MongoDB y servicios levantados.
- Visualización de estadísticas en navegador con datos reales.

### Pendiente

- Automatizar el E2E con una base de datos de prueba aislada.
- Edición o eliminación de reseñas: no se implementó porque la política definida las considera definitivas.

### Bloqueado

- Nada bloqueante para el alcance actual.

## 17. Cómo ejecutar y probar

### API

```bash
npm install
npm run build
npm run test
npm run dev
```

### Frontend

```bash
npm install
npm run build
npm test
npm run dev
```

### Prueba manual

1. Levantar los cuatro servicios de API y el frontend store.
2. Crear un pedido con delivery y completar el flujo hasta `delivered`.
3. Abrir el pedido y presionar `Calificar pedido`.
4. Enviar la calificación y verificar `Pedido calificado`.
5. Ingresar como branch/admin/rider y revisar las estadísticas.
6. Repetir con un pedido sin delivery para confirmar que no aparece el bloque de repartidor.
