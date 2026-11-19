# Informe — Restauración del código corto de pedido

Fecha: 2026-11-19
Repositorios auditados: `Food-Bosco-API` y `Food-Bosco-Frontend`
Alcance: corrección de visualización del identificador público del pedido.

## 1. Resumen

El código público del pedido ya se genera y se persiste correctamente como
`number` (secuencial de 6 dígitos, por ejemplo `001057`). El cliente lo muestra
desde ese campo. La regresión estaba en la app del repartidor (`rider`): la
pantalla de detalle usaba `tripOrder.orderId` como respaldo cuando el pedido
todavía no estaba cargado o la consulta fallaba. `orderId` es el ObjectId
interno de MongoDB (24 caracteres hexadecimales), por lo que el repartidor
veía ese identificador técnico en el lugar del código público.

La corrección elimina ese respaldo y hace que la app del repartidor use
exclusivamente `order.number` como código visible.

## 2. Diagnóstico

### Comportamiento esperado

- El pedido tiene un código público corto, legible y estable durante todo su
  ciclo de vida (`number`, 6 dígitos).
- Cliente y repartidor muestran el mismo `number`.
- El ObjectId interno (`id` / `orderId`) se usa sólo para relaciones,
  consultas y operaciones de base de datos, nunca como número visible.

### Comportamiento actual (antes del fix)

- Backend: correcto. Genera, persiste y expone `number`.
- Cliente (`apps/store`): correcto. Confirmación, historial, seguimiento y
  detalle usan `order.number`.
- Repartidor (`apps/rider`): en `TripOrderDetailPage`, el título se construía
  con `order?.number || tripOrder.orderId`. Mientras `useOrder` estaba
  cargando, o si la consulta no devolvía el pedido, se mostraba el ObjectId
  interno como si fuera el código del pedido.

## 3. Causa raíz

Archivo: `Food-Bosco-Frontend/apps/rider/src/pages/TripOrderDetailPage/index.tsx`.

La línea:

```ts
orderNumber={order?.number || tripOrder.orderId}
```

usaba un fallback con `tripOrder.orderId`. Ese campo no es el código público:
es el identificador interno con el que el viaje referencia al pedido en
Commerce. Al no estar disponible `order.number` (estado de carga o error de
consulta), la UI sustituía el código corto por el ObjectId largo.

No se encontró una segunda sustitución equivalente en el cliente. Las vistas
del cliente consumen `number` directamente:

- `apps/store/src/pages/CheckoutPage/index.tsx` (confirmación de compra).
- `apps/store/src/components/ActiveOrderCard/index.tsx` (pedido activo).
- `apps/store/src/pages/OrdersPage/index.tsx` (historial).
- `apps/store/src/pages/OrderDetailPage/index.tsx` (seguimiento).

La verificación de datos confirmó que los códigos públicos no son largos:
1.065 pedidos en la base, todos con `number` de 6 dígitos y ninguno con
formato de ObjectId.

## 4. Recorrido del problema

1. `OrderOrchestrator.create` crea el pedido en Commerce.
2. `OrderService.create` genera `number = String(count + 1).padStart(6, '0')`
   y lo persiste en `Order.number`.
3. `serializeOrder` devuelve `id` (ObjectId) y `number` (código público) por
   separado en la respuesta REST.
4. El Gateway GraphQL mapea ambos campos sin mezclarlos (`idOf(raw)` para
   `id`, `asString(raw.number)` para `number`).
5. El cliente consume `number` en confirmación, historial y seguimiento.
6. El repartidor obtiene los pedidos del viaje (`TripOrder.orderId`) y, por
   separado, consulta el detalle del pedido para obtener `number`. Cuando el
   detalle no estaba disponible, la UI caía en `orderId` y mostraba el
   identificador técnico.

## 5. Archivos modificados

| Archivo                                                                                               | Función o componente           | Modificación realizada                                                                              | Motivo                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Food-Bosco-Frontend/apps/rider/src/pages/TripOrderDetailPage/index.tsx`                              | `TripOrderDetailPage`          | Se quitó el fallback `\|\| tripOrder.orderId`; el título usa sólo `order?.number`.                  | Evitar que el ObjectId interno se muestre como código de pedido. |
| `Food-Bosco-Frontend/apps/rider/src/pages/TripOrderDetailPage/__tests__/TripOrderDetailPage.test.tsx` | Tests de `TripOrderDetailPage` | Se agregó un caso que verifica que `orderId` no se usa como número visible cuando falta el detalle. | Cubrir la regresión y evitar que vuelva.                         |

No se modificó el backend ni el contrato GraphQL/REST.

## 6. Resolución

El código público sigue siendo el mismo que genera y expone el backend:
`order.number` (6 dígitos). La app del repartidor ahora usa ese campo como
única fuente del número visible.

Si el detalle del pedido todavía no está disponible, el encabezado muestra
`Pedido` en lugar de un identificador técnico. Una vez que `useOrder` devuelve
el pedido, se muestra el mismo `number` que ve el cliente. No se creó un nuevo
campo, no se modificó el esquema de MongoDB y no se alteró la generación del
código.

## 7. Compatibilidad

- El identificador interno (`_id` / `id` / `orderId`) se conserva intacto y se
  sigue usando para rutas, relaciones y operaciones del viaje.
- El código público `number` se mantiene tal como estaba en la base; no se
  reescribieron pedidos históricos.
- No se modificaron endpoints REST, tipos GraphQL, DTOs, permisos ni
  autenticación.
- Los pedidos existentes siguen siendo consultables por `id` y siguen
  devolviendo `number`.
- No se agregaron dependencias.

## 8. Pruebas realizadas

| Prueba                              | Comando                                                                                                   | Resultado                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rider — detalle de pedido del viaje | `npx vitest run apps/rider/src/pages/TripOrderDetailPage/__tests__/TripOrderDetailPage.test.tsx`          | 16 tests aprobados (incluye el nuevo caso de regresión)                        |
| Store/API — pedidos del cliente     | `npx vitest run` sobre `OrdersPage`, `OrderDetailPage`, `purchase-flow`, `store`, `useOrder`, `useOrders` | 48 tests aprobados                                                             |
| Rider — tipos                       | `npm run typecheck --workspace=@repo/rider`                                                               | Sin errores                                                                    |
| Rider — lint                        | `npm run lint --workspace=@repo/rider`                                                                    | Sin errores                                                                    |
| Commerce — generación de número     | `npx jest order.service.spec.ts --runInBand`                                                              | 38 tests aprobados                                                             |
| Gateway — mapeo REST → GraphQL      | `npx jest commerce.types.spec.ts commerce.resolver.spec.ts --runInBand`                                   | 154 tests aprobados                                                            |
| Base de datos (sólo lectura)        | Consulta a `orders`                                                                                       | 1.065 pedidos; 0 con `number` ausente; 0 con formato largo; todos de 6 dígitos |

Limitaciones:

- No se ejecutaron pruebas e2e con los servicios y el broker levantados.
- No se realizó una prueba manual en navegador ni en el APK del repartidor.
- No se declararon como ejecutadas pruebas que no se corrieron.

## 9. Alcance e impacto

Se mantuvieron intactos:

- generación y persistencia del código de pedido;
- flujo de checkout y creación de pedidos;
- estados y transiciones;
- asignación de repartidores y viajes;
- calificaciones, reportes, stock y pagos;
- autenticación, autorización y permisos;
- contratos REST/GraphQL y esquema de MongoDB.

El diff funcional se limita a la pantalla de detalle del pedido del
repartidor y a su test. Los cambios preexistentes en `package-lock.json` y los
archivos no versionados de cada repositorio no forman parte de este fix.

## 10. Pendientes (fuera de alcance)

- La generación `count() + 1` no es resistente a concurrencia; puede colisionar
  bajo alta carga. Ya estaba documentada como deuda técnica y no se modificó.
- La misma fórmula puede colisionar si existen huecos en la numeración. En la
  base relevada había 1.065 pedidos y el máximo era `001066`, por lo que el
  próximo alta con `count() + 1` volvería a generar `001066`. No se corrigió
  porque el bug solicitado era de visualización; se recomienda un contador
  atómico o `max(number) + 1`.
- El detalle del repartidor muestra `Pedido` mientras carga el pedido. Se
  podría mostrar un skeleton o usar el `number` incluido en el viaje, pero
  excede este fix.
- Sería recomendable una prueba manual final en cliente y APK del repartidor
  con los servicios levantados.
