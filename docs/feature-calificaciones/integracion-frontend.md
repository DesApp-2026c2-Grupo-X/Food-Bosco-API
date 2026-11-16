# Integración frontend

## Puntos de entrada

- `apps/store/src/pages/OrderDetailPage/index.tsx`: pedido entregado muestra `Calificar pedido` o el resumen `Pedido calificado` con estrellas.
- `apps/store/src/pages/OrdersPage/index.tsx`: el historial muestra `Calificar pedido` en pedidos entregados sin reseña y `Pedido calificado` cuando ya existe.
- El formulario vive en un único componente: `apps/store/src/components/ReviewOrderModal`.

## Componentes

### `StarRating` (`packages/components`)

- Modo lectura con `role="img"` y etiqueta accesible.
- Modo interactivo con `role="radiogroup"` y botones `role="radio"`.
- Soporta mouse, teclado, hover, foco visible y estado deshabilitado.
- Tamaños `sm`, `md`, `lg`.

### `ReviewOrderModal`

- Mobile-first sobre `ResponsiveModal`.
- Título "¿Cómo estuvo tu pedido?" y descripción del beneficio.
- Bloque de sucursal siempre visible.
- Bloque de repartidor visible solo si `order.riderId` existe.
- Comentarios independientes con contador y límite de 500 caracteres.
- Validación local de ambas calificaciones obligatorias.
- Loading, bloqueo de doble envío, mensaje de error y toast.
- Al finalizar, cierra el modal y refresca el estado.

### `ReviewStatsPanel` (`packages/components`)

- Promedio, total de opiniones, distribución 1..5 y comentarios.
- Estados de carga y vacío.
- Reutilizado por branch, admin y rider.

## Hooks y operaciones (`packages/api`)

- `useMyOrderReviews`: reseñas del cliente, con mapa `orderId → review`.
- `usePendingOrderReviews`: pedidos entregados sin reseña.
- `useOrderReviewStatus(orderId)`: `canReview` y reseña existente.
- `useCreateOrderReview`: mutación con `refetchQueries` de `MyOrderReviews`, `PendingOrderReviews` y `OrderReviewStatus`, y `awaitRefetchQueries`.
- `useBranchReviewStats`, `useCourierReviewStats`, `useBranchRatingRanking`, `useCourierRatingRanking`, `useReviewsSummary`.

## Caché

- Las lecturas usan `fetchPolicy: 'network-only'` para reflejar el estado real del servidor.
- La mutación espera el refetch antes de cerrar el modal, por lo que el historial y el detalle se actualizan en la misma interacción.
- El listado de pedidos no cambia de contrato; el estado de calificación se resuelve con la consulta de reseñas.

## Pantallas administrativas

- `apps/branch/src/pages/RatingsPage`: calificaciones de la sucursal autenticada con filtro de período.
- `apps/admin/src/pages/RatingsPage`: resumen global y rankings de sucursales y repartidores.
- `apps/rider/src/pages/ProfilePage`: tarjeta "Tu reputación" con promedio, distribución y comentarios, sin datos personales del cliente.

## Manejo de errores

`getApiErrorMessage` traduce los códigos nuevos:

- `ORDER_NOT_DELIVERED`
- `ORDER_NOT_OWNED`
- `REVIEW_ALREADY_EXISTS`
- `COURIER_RATING_REQUIRED`
- `COURIER_NOT_ASSIGNED`
- `INVALID_REVIEW_RATING`

## Accesibilidad

- Radiogroups etiquetados por bloque.
- Botones de estrella con `aria-label` ("1 estrella"…"5 estrellas").
- Foco visible y navegación por teclado.
- El estado de solo lectura expone el promedio como texto alternativo.
