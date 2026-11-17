# Diseño técnico

## Flujo de creación

1. El cliente envía `createOrderReview(orderId, input)` al gateway.
2. El gateway autentica, valida rol `customer` y llama a `POST /v1/reviews/orders/:orderId` en Commerce.
3. `OrderReviewController` recibe el DTO validado y llama a `OrderReviewOrchestrator`.
4. El orchestrator:
   - busca el pedido con `OrderService`;
   - verifica que pertenezca al cliente autenticado;
   - verifica `status === delivered`;
   - verifica que la sucursal exista (`BranchService`);
   - valida coherencia del bloque repartidor contra `order.riderId`;
   - verifica que no exista una reseña previa;
   - delega la persistencia a `OrderReviewService`.
5. `OrderReviewService` valida rangos, normaliza comentarios y crea el documento.
6. El índice único sobre `orderId` protege ante dos envíos concurrentes; `E11000` se traduce a `REVIEW_ALREADY_EXISTS`.
7. El gateway mapea la respuesta al tipo GraphQL `OrderReview`.

## Responsabilidades

| Pieza                           | Responsabilidad                                    |
| ------------------------------- | -------------------------------------------------- |
| `OrderReviewController`         | HTTP, roles, usuario autenticado, DTOs             |
| `OrderReviewOrchestrator`       | Caso de uso: pedido + sucursal + reseña            |
| `OrderReviewService`            | Reglas de la reseña y estadísticas                 |
| `OrderReviewRepository`         | Mongoose y agregaciones                            |
| `ReviewsResolver` (gateway)     | Contratos GraphQL y traducción REST                |
| `OrderReviewFieldResolver`      | Composición de sucursal                            |
| `CourierRatingRowFieldResolver` | Composición del nombre del repartidor vía Delivery |

## Por qué no hay llamadas Commerce → Delivery

Commerce ya recibe `riderId` en el pedido cuando Delivery publica `trip.accepted`. La reseña solo necesita ese identificador. El nombre visible del repartidor se resuelve en el gateway con el endpoint interno existente `GET /v1/riders/by-user/:userId`, manteniendo la regla de servicios primarios aislados.

## Seguridad

| Rol            | Crear reseña                        | Ver estado propio | Estadísticas                        | Rankings |
| -------------- | ----------------------------------- | ----------------- | ----------------------------------- | -------- |
| `customer`     | Sí, solo pedidos propios entregados | Sí                | No                                  | No       |
| `branch_admin` | No                                  | No                | Solo su sucursal                    | No       |
| `super_admin`  | No                                  | No                | Todas las sucursales y repartidores | Sí       |
| `rider`        | No                                  | No                | Solo su propia reputación           | No       |

El backend valida roles y pertenencia. Los guards del frontend son solo experiencia de usuario; no son la fuente de verdad.

## Errores de dominio

| Código                    | HTTP | Cuándo                                                    |
| ------------------------- | ---- | --------------------------------------------------------- |
| `ORDER_NOT_FOUND`         | 404  | Pedido inexistente                                        |
| `ORDER_NOT_OWNED`         | 403  | Pedido de otro cliente                                    |
| `ORDER_NOT_DELIVERED`     | 409  | Pedido aún no entregado                                   |
| `REVIEW_ALREADY_EXISTS`   | 409  | Pedido ya calificado (incluye concurrencia)               |
| `INVALID_REVIEW_BRANCH`   | 409  | Sucursal del pedido inexistente                           |
| `COURIER_NOT_ASSIGNED`    | 400  | Se enviaron datos de repartidor en un pedido sin delivery |
| `COURIER_RATING_REQUIRED` | 400  | Pedido con repartidor sin calificación de repartidor      |
| `INVALID_REVIEW_RATING`   | 400  | Puntaje fuera de rango o no entero                        |
| `VALIDATION_ERROR`        | 400  | DTO inválido o comentario demasiado largo                 |
| `FORBIDDEN`               | 403  | Rol o alcance insuficiente                                |
| `SERVICE_UNAVAILABLE`     | 503  | Falla de comunicación entre servicios                     |

El formato de error es el existente: `{ code, message, details?, path, requestId? }`.
