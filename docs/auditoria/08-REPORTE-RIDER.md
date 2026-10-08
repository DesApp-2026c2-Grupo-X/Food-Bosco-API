# REPORTE — REPARTIDOR (`apps/rider`)

> **Estado:** HISTÓRICO — hallazgos de auditoría de solo lectura (2026-10-06). Correcciones aplicadas en [`15-INFORME-CORRECCIONES.md`](15-INFORME-CORRECCIONES.md).

> Nota: `docs/planRider.md` afirma que `apps/rider` está vacía; es **FALSO**: la app está implementada y migrada a GraphQL.

## Resumen

- **Objetivo:** disponibilidad, ubicación, ofertas de viaje, retiro/entrega, historial y perfil.
- **Estado general:** funcional en el entorno local (con broker configurado).
- **Cumplimiento estimado:** ~95%.
- Requerimientos: RF-080..089.

## Requerimientos cumplidos

| ID     | Requerimiento                  | Frontend                                        | Backend                     | Estado |
| ------ | ------------------------------ | ----------------------------------------------- | --------------------------- | ------ |
| RF-080 | Login repartidor               | `rider/App.tsx` roles `['rider']`               | auth                        | ✅     |
| RF-081 | Online/offline                 | `useRiderProfile.setAvailability`, `riderStore` | `rider.controller.ts:39`    | ✅     |
| RF-082 | Ofertas de viaje por ubicación | `useTripOffers` (poll 15s)                      | `offer.controller.ts:22`    | ✅     |
| RF-083 | Aceptar/rechazar               | `TripOfferCard`                                 | `offer.controller.ts:27-40` | ✅     |
| RF-084 | Retiro/entrega por orden       | `TripOrderDetailPage`                           | `offer.controller.ts:42-58` | ✅     |
| RF-085 | Detalle de orden del viaje     | `TripOrderDetailPage`                           | `offer.controller.ts`       | ✅     |
| RF-086 | Historial de viajes            | `HistoryPage`, `useMyTrips`                     | `offer.controller.ts:60`    | ✅     |
| RF-087 | Perfil repartidor              | `ProfilePage`, `EditProfilePage`                | `rider.controller.ts:18-31` | ✅     |
| RF-088 | Compartir ubicación            | `useRiderLocation` (watchPosition)              | `rider.controller.ts:47`    | ✅     |
| RF-089 | Editar vehículo                | `VehicleEditPage`                               | `updateRiderVehicle`        | ✅     |

## Requerimientos parciales / dependientes de entorno

| ID        | Qué funciona                            | Qué falta                                                                               | Prioridad |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| RQ-DLV-03 | ofrece viajes al repartidor por polling | requiere que el evento `order.status_changed` cruce procesos: **necesita `BROKER_URL`** | Alta      |
| RQ-DLV-05 | expiración de oferta (countdown)        | sin dedupe de eventos (doble asignación posible)                                        | Media     |

## Inconsistencias

| ID        | Problema                                      | Frontend              | Backend                                                         | Impacto                       | Prioridad |
| --------- | --------------------------------------------- | --------------------- | --------------------------------------------------------------- | ----------------------------- | --------- |
| RQ-COM-05 | consumo de eventos no idempotente             | —                     | `rabbit.transport.ts:52` `noAck:true`, sin dedupe por `eventId` | ofertas duplicadas/perdidas   | Media     |
| —         | trip detail reusa la query `ORDER` de cliente | `TripOrderDetailPage` | permiso depende de que el backend permita al rider leer `order` | acoplamiento                  | Media     |
| —         | `Rider.vehicle` objeto vs String (auth)       | `rider.ts` objeto     | `user.model.ts` String                                          | doble tipo del mismo concepto | Media     |

## Funcionalidades adicionales

- Deep-link a Google Maps (navegación externa).
- Gate de proximidad 50 m antes de habilitar Retirar/Entregar.
- Página separada de edición de vehículo (`/profile/vehicle`).

## Problemas técnicos

- `apps/store/.env.native` no define `VITE_RIDER_URL` (afecta redirección desde build nativo).

## Recomendaciones

1. Garantizar `BROKER_URL` fuera de test + idempotencia por `eventId` (Alta).
2. Unificar `Rider.vehicle` (Media).
3. Definir una query de pedido específica del rider (Media).
