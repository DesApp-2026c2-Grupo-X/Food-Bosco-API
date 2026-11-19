# Informe técnico — Fix: eliminar productos del carrito

- Fecha: 2026-11-19
- Repositorios revisados: `Food-Bosco-API` y `Food-Bosco-Frontend`
- Rama del informe (API): `fix/eliminar-productos-carrito`
- Rama base: `develop`

## 1. Resumen

Se solicitó incorporar la opción para quitar productos individuales del carrito de compras.
Durante la revisión previa se verificó que **la funcionalidad ya existe de punta a punta**
en el frontend y en el backend: hay botón de eliminación por ítem, mutación GraphQL,
endpoint REST, recálculo de totales, persistencia y representación del carrito vacío.

Por ese motivo **no se modificó código fuente**. Implementar otra acción de eliminación
habría duplicado lógica y alterado una funcionalidad que ya cumple el comportamiento pedido.
El trabajo de este fix quedó limitado a la verificación, las pruebas y este informe.

## 2. Diagnóstico inicial

El enunciado indicaba que el carrito solo permitía agregar productos y modificar cantidades.
Al contrastar esa premisa con el código real se encontró lo siguiente:

- La página del carrito (`CartPage`) renderiza cada línea con `CartLineCard` y le pasa
  `onRemove={removeItem}`.
- `CartLineCard` muestra un botón visible con ícono de papelera y texto **Eliminar**.
- El hook compartido `useCart` ya expone `removeItem(itemId)`, que ejecuta la mutación
  `RemoveCartItem` y luego vuelve a consultar `MyCart`.
- El backend ya expone `DELETE /v1/carts/items/:itemId` en el servicio `commerce`, y el
  gateway GraphQL ya expone la mutación `removeCartItem`.
- El carrito lateral (`CartDrawer`) también usa la misma acción de eliminación.

La limitación descrita en el enunciado **no se reproduce** sobre la rama `develop`
ni sobre las ramas de trabajo actuales. La funcionalidad está registrada además como
requerimiento `RQ-CART-05` y `RQ-CART-10` en la especificación del backend.

## 3. Arquitectura identificada

El carrito se administra con el backend como fuente de verdad:

1. El estado remoto se obtiene con la query `MyCart` mediante Apollo Client.
2. `useCart` centraliza las mutaciones `AddCartItem`, `UpdateCartItem`, `RemoveCartItem`
   y `SetCartPromotionCode`.
3. Después de cada mutación se ejecuta `refetch()` de `MyCart`, de modo que la interfaz
   refleja la respuesta autoritativa del servidor.
4. La identificación del ítem se hace por `CartItem.id` (identificador de la línea del
   carrito), no por `productId`. Esto permite distinguir el mismo producto agregado con
   variantes, opciones u observaciones diferentes.
5. En el backend, el gateway traduce la mutación GraphQL a una llamada REST al servicio
   `commerce`. El `CartOrchestrator` filtra la línea por `itemId`, recalcula el total con
   los precios actuales, aplica la lógica de promociones y persiste el carrito completo.
6. Los cálculos de subtotales y total también existen como funciones puras de dominio
   (`cartLineUnitPrice`, `cartLineTotal`, `cartItemCount`, `cartTotal`).

## 4. Implementación

No se agregó ni modificó código de la aplicación. La acción solicitada ya está implementada
en los siguientes puntos:

- **Interfaz:** `CartLineCard` (`apps/store/src/components/CartLineCard/index.tsx`) muestra
  la acción **Eliminar**, que invoca `onRemove(item.id)`. Se usa tanto en la página del
  carrito como en el panel lateral del carrito.
- **Estado y sincronización:** `useCart` (`packages/api/src/hooks/useCart.ts`) ejecuta la
  mutación `REMOVE_CART_ITEM` y refresca el carrito. El estado de mutación deshabilita los
  controles mientras la operación está en curso.
- **Contrato:** `REMOVE_CART_ITEM` (`packages/api/src/client/store.ts`) envía `itemId` y
  solicita el carrito actualizado.
- **Backend GraphQL:** `removeCartItem` (`apps/gateway/src/graphql/commerce/commerce.resolver.ts`)
  exige rol `customer` y llama a `DELETE /v1/carts/items/:itemId`.
- **Backend REST:** `CartController.removeItem` (`apps/commerce/src/cart/cart.controller.ts`)
  delega en `CartOrchestrator.removeItem` (`apps/commerce/src/cart/cart.orchestrator.ts`),
  que elimina solo la línea seleccionada, recalcula el total y persiste el carrito.

La lógica existente cubre todos los casos pedidos, incluido eliminar la línea completa
aunque la cantidad sea mayor a uno.

## 5. Archivos modificados

| Repositorio    | Archivo                                                                  | Función o componente           | Modificación | Justificación                                                              |
| -------------- | ------------------------------------------------------------------------ | ------------------------------ | ------------ | -------------------------------------------------------------------------- |
| Food-Bosco-API | `docs/implementacion/informe-fix-eliminar-productos-carrito.md`          | Informe técnico                | Alta         | Documentar la verificación y el resultado del fix.                         |
| Food-Bosco-API | `docs/prompts/general/2026-11-19-0100-fix-eliminar-productos-carrito.md` | Registro de interacción con IA | Alta         | Dejar registro del pedido y del análisis según la convención del proyecto. |

No se modificaron archivos de código fuente en el backend ni en el frontend.

## 6. Funcionamiento final

1. El usuario abre el carrito desde la página o desde el panel lateral.
2. Cada producto muestra la acción **Eliminar**.
3. Al pulsarla, el frontend envía `RemoveCartItem` con el `id` de esa línea.
4. El gateway valida el rol del cliente y llama al endpoint REST de commerce.
5. El orchestrator verifica que la línea exista; si no existe responde 404 con
   `cartItemNotFound`. Si existe, arma la lista sin ese ítem, recalcula el total y guarda
   el carrito.
6. El frontend vuelve a consultar `MyCart` y actualiza líneas, contador y totales.
7. Si se eliminó el último producto, la lista queda vacía y la interfaz muestra el estado
   **Tu carrito está vacío**. El checkout, a su vez, muestra **Nada para confirmar** y no
   permite continuar con un carrito vacío.

## 7. Pruebas realizadas

### Pruebas automatizadas ejecutadas

| Comando / alcance                                                                                           | Resultado                                                                              |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npx vitest run` sobre `CartLineCard`, `CartPage` (unitaria e integración), `useCart` y dominio del carrito | 30 tests aprobados en 5 archivos                                                       |
| `npx vitest run` sobre `purchase-flow.test.tsx` y `CartButton`                                              | 9 tests aprobados en 3 archivos                                                        |
| `npx jest src/cart` en `apps/commerce`                                                                      | 76 tests aprobados en 4 suites                                                         |
| `npm run test` en `Food-Bosco-API` (suite completa de unit tests)                                           | 6 tareas exitosas: auth 750, commerce 1595, delivery 601 y gateway 664 tests aprobados |
| `npx jest ... -t "removeCartItem"` en `apps/gateway`                                                        | 1 test aprobado (los demás se omitieron por el filtro)                                 |

### Casos verificados

| Caso                                         | Resultado                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carrito con un producto                      | Cubierto por las pruebas de `CartPage` y `CartLineCard`; la línea se elimina.                                                                                  |
| Carrito con varios productos                 | El filtro es por `item.id`, por lo que solo se quita la línea seleccionada. Verificado por revisión de código y por las pruebas de integración de la mutación. |
| Eliminar el último producto                  | Cubierto por `CartPage.integration` y por el test del orchestrator que deja la lista vacía y el total en 0.                                                    |
| Producto con cantidad mayor a uno            | El backend filtra la línea completa sin tocar la cantidad; cubierto por el test del orchestrator con cantidad 2.                                               |
| Productos con precios distintos              | El total se recalcula en el servidor y se vuelve a consultar el carrito; cubierto por los tests de cálculo de dominio y del orchestrator.                      |
| Productos con variantes u opciones distintas | La identificación es por `CartItem.id`, no por `productId`; las líneas con opciones distintas son ítems distintos.                                             |
| Actualización inmediata del carrito          | `useCart.removeItem` ejecuta la mutación y luego `refetch`; cubierto por `CartPage.integration`.                                                               |
| Persistencia                                 | El carrito se guarda en el backend mediante `replaceItems`; no se ejecutaron pruebas end-to-end contra base de datos real en este fix.                         |
| Checkout con productos restantes             | El flujo existente no cambió; las pruebas de `purchase-flow` validan el agregado y el guardado del checkout vacío.                                             |
| Carrito vacío                                | La página muestra el estado vacío y el checkout bloquea la continuación; cubierto por pruebas de `CartPage` y `purchase-flow`.                                 |

### Limitaciones

- La suite completa del frontend se intentó ejecutar con `npm run test`, pero el proceso
  superó el tiempo límite configurado (15 minutos) y no emitió el resumen final. Por eso
  se ejecutaron y reportaron las suites específicas del carrito, checkout y contador.
- No se levantó la aplicación ni una base de datos real para una prueba manual de punta a
  punta; la validación se apoya en las pruebas automatizadas y en la lectura del código.

## 8. Compatibilidad

- No se alteró el contrato GraphQL ni los endpoints REST.
- No se modificaron modelos, DTOs, validaciones, permisos ni roles.
- Agregar productos, modificar cantidades, aplicar cupones, calcular totales y confirmar
  pedidos conservan el comportamiento previo.
- El contador del carrito sigue usando `cartItemCount` sobre las líneas devueltas por la
  API, por lo que se actualiza con el mismo `refetch` que ya existía.
- El checkout continúa usando `useCart` y mantiene su guardado para carrito vacío.

## 9. Control de alcance

No se modificó código fuente. No se tocaron checkout, pagos, stock, sucursales,
repartidores, calificaciones, reportes, autenticación, autorización, componentes ajenos al
carrito ni estilos globales. El único cambio es documental.

## 10. Git

- **Food-Bosco-API**
  - Rama creada: `fix/eliminar-productos-carrito`
  - Rama base: `develop`
  - Estado: rama publicada en `origin` con un commit documental.
  - Archivos nuevos de este fix: informe técnico y registro de prompt.
  - Se preservaron sin modificar los cambios locales preexistentes (`package-lock.json` y
    documentos sin seguimiento que ya estaban en el árbol de trabajo).
  - Commit: `46863ee docs(carrito): documentar fix de eliminacion de productos`.
  - Pull request: [#50](https://github.com/DesApp-2026c2-Grupo-X/Food-Bosco-API/pull/50).
- **Food-Bosco-Frontend**
  - No se creó rama ni se modificaron archivos: no se requieren cambios en este repositorio.
  - La rama actual y los cambios locales preexistentes se preservaron sin alteraciones.
  - Commits: ninguno.

No se realizaron merges, pushes ni operaciones destructivas.

## 11. Pendientes

- La especificación de frontend menciona eliminar un ítem con confirmación previa y un
  estado de carga individual por ítem. La implementación actual elimina directamente y
  deshabilita todos los controles mientras hay una mutación. No se modificó porque el
  pedido era incorporar la opción de eliminación, que ya existe, y porque cambiar ese
  comportamiento queda fuera del alcance de este fix.
- Queda pendiente una prueba manual end-to-end con backend y base de datos levantados.
