# REPORTE — TIENDA (`apps/store`)

## Resumen

- **Objetivo:** catálogo, carrito, checkout, pedidos y perfil del cliente.
- **Estado general:** funcional; núcleo completo salvo repetir pedido.
- **Cumplimiento estimado:** ~90%.
- Requerimientos: RF-010..025.

## Requerimientos cumplidos

| ID     | Requerimiento                | Frontend                                 | Backend                       | Estado |
| ------ | ---------------------------- | ---------------------------------------- | ----------------------------- | ------ |
| RF-010 | Home de la tienda            | `HomePage`                               | catálogo                      | ✅     |
| RF-011 | Catálogo con búsqueda/filtro | `CatalogPage`, `useCatalog`              | `commerce.resolver.ts:109`    | ✅     |
| RF-012 | Detalle + configurador       | `ProductDetailPage`, `useProductConfig`  | `product.controller.ts`       | ✅     |
| RF-013 | Sucursales disponibles       | `SucursalesPage`, `useAvailableBranches` | `branch.service.ts:63`        | ✅     |
| RF-014 | Carrito server-side          | `CartPage`, `useCart`                    | `cart.controller.ts`          | ✅     |
| RF-016 | Checkout resumen + confirmar | `CheckoutPage`                           | `order.controller.ts:47`      | ✅     |
| RF-018 | Seguimiento del pedido       | `OrderDetailPage` (timeline+mapa)        | `order.controller.ts`         | ✅     |
| RF-019 | Historial de pedidos         | `OrdersPage`, `useOrders`                | `commerce.resolver.ts:292`    | ✅     |
| RF-021 | Perfil del cliente           | `ProfilePage`, `EditProfilePage`         | `me.controller.ts`            | ✅     |
| RF-022 | Lista de direcciones         | `AddressesPage`                          | `address.controller.ts`       | ✅     |
| RF-023 | Crear/editar dirección       | `AddressForm`, `AddressSheet`            | `address.controller.ts:23,40` | ✅     |
| RF-024 | Modal de dirección           | `AddressPickerModal`                     | n/a                           | ✅     |

## Requerimientos parciales

| ID     | Qué funciona                                  | Qué falta                                                                | Prioridad |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------ | --------- |
| RF-015 | selección de dirección (modal + persistencia) | paso/ruta dedicada `/checkout/address` y validación previa de sucursales | Media     |
| RF-017 | éxito del pedido (inline)                     | ruta `/orders/:id/confirmed` recuperable al recargar                     | Media     |
| RF-025 | mapa estático (`InteractiveMap`)              | requiere `VITE_GEOAPIFY_API_KEY`; sin key usa fallback                   | Baja      |

## Requerimientos incumplidos

| ID     | Situación actual                               | Qué falta                                               | Prioridad |
| ------ | ---------------------------------------------- | ------------------------------------------------------- | --------- |
| RF-020 | backend `repeatOrder` listo; FE sin botón/hook | UI + mutación `repeatOrder` (mostrar `skippedProducts`) | Alta      |

## Inconsistencias

| ID         | Problema                                     | Frontend                                         | Backend                                                           | Impacto                     | Prioridad |
| ---------- | -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- | --------------------------- | --------- |
| RQ-CART-04 | no se editan observaciones/opciones del ítem | `CartLineCard:67` solo cantidad                  | `update-cart-item.dto.ts` soporta quantity/observations/optionIds | funcionalidad perdida en UI | Alta      |
| RF-010     | hero hardcodeado                             | `HomePage:236,258` (imagen Unsplash + "~35 min") | —                                                                 | dato no real                | Baja      |
| paginación | listas de pedidos sin `page/limit`           | hooks no envían                                  | default 20                                                        | posible truncado            | Media     |

## Funcionalidades adicionales

- Geocoding Geoapify (`client/geo.ts`) y mapas Leaflet (contradice "no mapa" de T-08/T-18).
- App nativa Capacitor Android/iOS (fuera de alcance web).
- Persistencia de dirección seleccionada en localStorage.

## Problemas técnicos

- `.env.native` versionado con API key real y sin `VITE_BRANCH_URL`/`VITE_RIDER_URL`.
- `MOCK_AUTH`/`forceAuth` en el guard.

## Recomendaciones

1. Implementar Repetir Pedido (Alta).
2. UI de edición de observaciones/opciones del carrito (Alta).
3. Ruta de "pedido confirmado" recuperable (Media).
4. Enviar paginación y agregar "cargar más" (Media).
5. Rotar clave Geoapify y desversionar `.env.native` (Alta).
