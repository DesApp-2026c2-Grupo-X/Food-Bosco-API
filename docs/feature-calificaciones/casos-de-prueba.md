# Casos de prueba

## Backend — unitarios

Archivos:

- `apps/commerce/src/order-review/order-review.service.spec.ts`
- `apps/commerce/src/order-review/order-review.orchestrator.spec.ts`
- `apps/commerce/src/order-review/dto/order-review-dtos.spec.ts`

Cobertura:

| Caso                                          | Resultado esperado                          |
| --------------------------------------------- | ------------------------------------------- |
| Puntajes 1 y 5 (límites)                      | Válido                                      |
| Puntaje 0, 6 o decimal                        | `INVALID_REVIEW_RATING`                     |
| Comentario de 500 caracteres                  | Válido                                      |
| Comentario de 501 caracteres                  | `VALIDATION_ERROR`                          |
| Comentario vacío o con espacios               | Se guarda `null`                            |
| Pedido inexistente                            | `ORDER_NOT_FOUND`                           |
| Pedido de otro cliente                        | `ORDER_NOT_OWNED`                           |
| Pedido no entregado                           | `ORDER_NOT_DELIVERED`                       |
| Sucursal inexistente                          | `INVALID_REVIEW_BRANCH`                     |
| Pedido ya calificado                          | `REVIEW_ALREADY_EXISTS`                     |
| Índice único (`E11000`)                       | `REVIEW_ALREADY_EXISTS`                     |
| Pedido con delivery sin puntaje de repartidor | `COURIER_RATING_REQUIRED`                   |
| Pedido sin delivery con datos de repartidor   | `COURIER_NOT_ASSIGNED`                      |
| Pedido sin delivery solo con sucursal         | Válido, `courierId/courierRating` en `null` |
| Sucursal y repartidor tomados del pedido      | El input del cliente no puede imponerlos    |
| `getStatus` entregado sin reseña              | `canReview: true`                           |
| `getStatus` entregado con reseña              | `canReview: false`                          |
| `getStatus` en camino/cancelado               | `canReview: false`                          |
| Pendientes excluye pedidos con reseña         | Solo devuelve los no calificados            |
| Rankings y resumen                            | Delegación correcta al repositorio          |

## Backend — consultas y regresiones

Se ejecutaron las suites completas:

- Commerce: 70 suites, 1587 tests aprobados.
- Gateway: 33 suites, 655 tests aprobados.

## Frontend — componentes

- `packages/components/src/__tests__/star-rating.test.tsx`
  - lectura con etiqueta accesible;
  - selección con mouse;
  - selección con teclado;
  - estado deshabilitado y `aria-checked`.
- `apps/store/src/components/ReviewOrderModal/__tests__/ReviewOrderModal.test.tsx`
  - bloque de repartidor visible/oculto;
  - validación de sucursal;
  - validación de repartidor;
  - envío con comentarios independientes;
  - pedido sin delivery;
  - error de backend sin cerrar modal;
  - prevención de doble envío.

## Frontend — páginas

- `OrderDetailPage`: botón `Calificar pedido`, resumen `Pedido calificado` y ausencia de acción antes de la entrega.
- `OrdersPage`: acción en pedidos entregados, etiqueta `Pedido calificado` y ausencia de acción en pedidos activos.

## Escenarios E2E manuales recomendados

1. Cliente crea pedido con delivery.
2. Sucursal avanza el pedido hasta `ready_for_delivery`.
3. Repartidor acepta viaje, retira y marca entrega.
4. El pedido queda `delivered` en Commerce.
5. El cliente abre el detalle y presiona `Calificar pedido`.
6. Califica sucursal y repartidor, con comentarios.
7. El modal confirma, el historial muestra `Pedido calificado`.
8. La sucursal ve el promedio y el comentario en su panel.
9. El admin ve el ranking actualizado.
10. El repartidor ve su reputación.
11. Repetir con un pedido sin delivery: solo aparece el bloque de sucursal.
12. Intentar calificar un pedido ajeno o no entregado por API: recibe `403`/`409`.
13. Enviar dos veces el mismo pedido: la segunda recibe `REVIEW_ALREADY_EXISTS`.

Estado de ejecución:

- Automatizado y ejecutado: unitarios backend, suites completas de Commerce/Gateway y tests de frontend listados.
- No automatizado: flujo E2E contra MongoDB y servicios levantados. Requiere entorno con base de datos y brokers; queda documentado como validación manual.
