# INFORME GLOBAL — Food-Bosco

## 1. Objetivo

Verificar la correspondencia `REQUERIMIENTOS → FRONTEND → BACKEND → BASE DE DATOS → FLUJOS`,
determinar qué está implementado, parcial, ausente, inconsistente o roto, y en qué orden corregirlo.

## 2. Aplicaciones

| Documentado (specs)                         | Real en repos                                                       | Estado                      |
| ------------------------------------------- | ------------------------------------------------------------------- | --------------------------- |
| `apps/auth` (frontend)                      | **no existe** → `packages/auth` (`@repo/auth`) embebido en cada app | Reubicado                   |
| `apps/store`                                | `apps/store` (5173)                                                 | Implementado                |
| `apps/admin` (admin global)                 | `apps/admin` (5174), rol `super_admin`                              | Implementado                |
| `apps/branch` (admin sucursal)              | `apps/branch` (5175), rol `branch_admin`                            | Implementado                |
| `apps/rider`                                | `apps/rider` (5176), rol `rider`                                    | Implementado                |
| `apps/admin-global` (nombre en doc backend) | ≡ `apps/admin`                                                      | Solo discrepancia de nombre |

**Backend:** `apps/gateway` (4000, GraphQL) + `apps/auth` (4201) + `apps/commerce` (4202) + `apps/delivery` (4203), MongoDB compartida `fastfood`.

## 3. Estadísticas globales (279 ítems)

| Clasificación     | Cantidad |     % |
| ----------------- | -------: | ----: |
| ✅ CUMPLE         |      215 | 77,1% |
| 🟡 PARCIAL        |       37 | 13,3% |
| ⚠️ INCONSISTENTE  |       14 |  5,0% |
| ❌ NO CUMPLE      |       12 |  4,3% |
| 🔵 NO VERIFICABLE |        1 |  0,4% |

> Desglose: RF 72 (✅56/🟡9/⚠️4/❌3), RQ 150 (✅124/🟡12/⚠️9/❌4/🔵1), RN 32 (✅24/🟡5/⚠️1/❌2), RNF 25 (✅11/🟡11/❌3).
> **Cumplimiento efectivo (✅ + 0,5×🟡): ≈ 83,7%.**

## 4. Cumplimiento por aplicación

| Aplicación             | Cumplimiento | 🔴 Críticos | 🟠 Altos | 🟡 Medios | 🟢 Bajos |
| ---------------------- | -----------: | ----------: | -------: | --------: | -------: |
| Auth (`packages/auth`) |         ~95% |           0 |        1 |         2 |        1 |
| Store                  |         ~90% |           0 |        3 |         3 |        2 |
| Admin global           |         ~85% |           0 |        3 |         4 |        3 |
| Branch                 |         ~90% |           0 |        2 |         2 |        1 |
| Rider                  |         ~95% |           0 |        1 |         1 |        1 |
| Backend (API)          |         ~85% |           4 |        6 |         6 |        4 |

## 5. Problemas críticos

| #   | Hallazgo                                                                                 | Evidencia                                     | Impacto                                                                           |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| S1  | `POST /seed` del gateway sin guard                                                       | `apps/gateway/src/seed/seed.controller.ts:33` | Reseed y recreación de usuarios admin sin auth.                                   |
| S2  | Seed crea `super_admin` con contraseña default `Admin123!`                               | `auth/config/env.ts:52`                       | Toma de control conocida (con S1).                                                |
| S3  | Defaults `JWT_SECRET='dev-secret-change-me'` e `INTERNAL_API_TOKEN='dev-internal-token'` | `apps/*/src/config/env.ts`                    | Forja de JWT y bypass de RBAC.                                                    |
| S4  | `GET /v1/orders` sin `@Roles`                                                            | `commerce/order/order.controller.ts:25`       | Un `rider` podría listar pedidos de una sucursal si el puerto 4202 es alcanzable. |
| S5  | Secreto real versionado (Geoapify)                                                       | `apps/store/.env.native:3`                    | Clave filtrada en git.                                                            |

## 6. Inconsistencias críticas

- **Repetir pedido, Promociones y Estados generales**: backend + gateway completos, **sin UI en frontend**.
- **Toggle abierto/cerrado de sucursal**: solo local (`branchStatusStore`), el backend no lo modela.
- **`createStaff` no valida `branchId`** contra Commerce (RQ-AUTH-13).
- **Edición de observaciones/opciones del carrito**: backend completo, sin UI (solo cantidad).
- **Flujo de eventos Commerce↔Delivery**: funciona solo si `BROKER_URL` está configurado; con el default del `.env.example` (vacío) usa bus in-process y **no funciona**.
- **Paginación**: el frontend nunca envía `page/limit`; varias listas se truncan a 20.

## 7. Requerimientos faltantes

RF-020 (repetir pedido), RF-060/061 (promociones), RF-064 (estados), RQ-AUTH-13 (validar sucursal),
RQ-REST-01/02/03 (OpenAPI/codegen), RQ-GW-08 (`TripOrder.order`), RQ-GW-09 (DataLoader batch real).

## 8. Funcionalidades adicionales (presentes en código, no en requisitos)

- Auto-registro público de rider (contradictorio: la spec dice solo `super_admin`).
- App nativa Capacitor Android/iOS (store).
- Geocoding Geoapify + mapas Leaflet en la Tienda (la spec dice "no mapa").
- Deep-link a Google Maps + gate de proximidad 50 m (rider).
- Dashboards analíticos (`reportsOverview`).
- Zonas y turnos de delivery (implementados, sembrados, sin consumidor).

## 9. Respuesta a la pregunta final

> **¿Qué porcentaje está realmente implementado, qué está incompleto, qué está roto y qué inconsistencias existen?**

- **Implementado real (✅ + parcial ponderado): ≈ 84% global.**
- **Incompleto:** repetir pedido, promociones, estados, edición de opciones/observaciones del carrito,
  ruta de "pedido confirmado" recuperable, toggle de sucursal, subida de imagen sin Cloudinary, paginación.
- **Roto / dependiente de entorno:** flujo de ofertas de reparto con `BROKER_URL` vacío, subida de imagen
  sin credenciales Cloudinary, correo de recuperación en modo `log`.
- **Inconsistencias FE↔BE más graves:** 3 features backend sin superficie frontend; seguridad delegada a
  defaults débiles; `/seed` y `@Internal`; `GET /v1/orders` sin rol; ausencia del paquete de contratos OpenAPI.

**Existe un núcleo funcional sólido y mayormente trazable. La deuda se concentra en (a) seguridad de
despliegue, (b) features backend ya construidas pero sin UI, (c) contrato/codegen y consistencia de dominio,
y (d) documentación desactualizada.**
