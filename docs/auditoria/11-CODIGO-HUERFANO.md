# CÓDIGO HUÉRFANO / INCOMPLETO / MOCK — Food-Bosco

> **Estado:** HISTÓRICO — hallazgos de auditoría de solo lectura (2026-10-06). Correcciones aplicadas en [`15-INFORME-CORRECCIONES.md`](15-INFORME-CORRECCIONES.md).

Diferenciación: **Reutilizable** (superficie de librería legítima) vs **Abandonado/Incompleto/Duplicado/Mock-Stale**.

| #   | Repo  | Elemento                                              | Ubicación                                                                 | Clasificación               | Evidencia de desuso                                   | Riesgo     |
| --- | ----- | ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- | ---------- |
| 1   | FE    | `MOCK_BRANCH_NAME`                                    | `packages/api/src/mocks/branch.ts:3`                                      | Mock-Stale                  | fallback en `BranchLayout/index.tsx:17`               | Bajo       |
| 2   | FE    | `MOCK_BRANCH_ADMIN` / `MOCK_SUPER_ADMIN`              | `mocks/branch.ts:5`, `mocks/staff.ts:3`                                   | Mock-Stale                  | fallback en ProfilePage de branch/admin               | Bajo       |
| 3   | FE    | `notifyInfo` exportado sin uso                        | `components/src/index.ts:5`, `Toaster/toaster.ts:22`                      | Reutilizable                | sin consumidor externo                                | Bajo       |
| 4   | FE    | Componentes usados solo internamente                  | `packages/components/src/index.ts`                                        | Reutilizable                | no es error                                           | Nulo       |
| 5   | FE    | `PasswordInput`→`PasswordField`→`FormPasswordField`   | `packages/components/src/*`                                               | Duplicado (composición)     | wrapper en cadena                                     | Legítimo   |
| 6   | FE    | `OrderDetailView` vs `OrderDetailShell`               | `packages/components/src/*`                                               | Duplicado (casos distintos) | admin/branch vs store/rider                           | Aceptable  |
| 7   | FE    | Toggle sucursal local-only                            | `apps/branch/src/stores/branchStatusStore.ts:13`                          | Incompleto                  | persist local, sin API                                | Medio      |
| 8   | FE    | Profile admin/branch read-only + mock                 | `admin/.../ProfilePage/index.tsx:6`, `branch/.../ProfilePage/index.tsx:6` | Incompleto                  | usa `MOCK_*`                                          | Bajo-Medio |
| 9   | FE    | Hero ETA hardcodeada                                  | `apps/store/src/pages/HomePage/index.tsx:258`                             | Mock-Stale                  | valor fijo                                            | Bajo       |
| 10  | FE    | Hero imagen hardcodeada                               | `apps/store/src/pages/HomePage/index.tsx:236`                             | Mock-Stale                  | Unsplash fijo                                         | Bajo       |
| 11  | FE    | `.env.native` con secreto real                        | `apps/store/.env.native:1,3`                                              | Mock-Stale                  | git-tracked; falta `VITE_BRANCH_URL`/`VITE_RIDER_URL` | Alto       |
| 12  | FE    | Proxy `/api` muerto                                   | `apps/branch/vite.config.ts:6`                                            | Abandonado                  | sin consumidor                                        | Bajo       |
| 13  | FE    | `createAppConfig({ self })` ignora `self`             | `packages/auth/src/appConfig.ts:23`                                       | Incompleto                  | `void self`                                           | Bajo       |
| 14  | FE    | Test huérfano                                         | `packages/domain/test/helpers.test.js`                                    | Reutilizable                | no matchea glob de vitest                             | Bajo       |
| 15  | FE    | `admin/STATUS.md` y `store/STATUS.md` desactualizados | `apps/admin/STATUS.md`, `apps/store/STATUS.md`                            | Mock-Stale                  | describen archivos inexistentes                       | Medio      |
| 16  | BE    | `AppController` no registrado                         | `apps/delivery/src/app.controller.ts:5`                                   | Abandonado                  | sin `controllers:` en module                          | Bajo       |
| 17  | BE    | Artefactos `dist` stale                               | `apps/delivery/dist/offer/trip-admin.controller.*`                        | Abandonado                  | sin fuente; dist no trackeado                         | Bajo       |
| 18  | BE    | Zonas sin consumidor                                  | `apps/delivery/src/zone/*`                                                | Abandonado/Incompleto       | registrado+sembrado; sin resolver/FE                  | Medio      |
| 19  | BE    | Turnos sin consumidor                                 | `apps/delivery/src/shift/*`                                               | Abandonado/Incompleto       | idem                                                  | Medio      |
| 20  | BE    | `StockMovement` tipo sin query                        | `apps/gateway/.../commerce.types.ts:369`                                  | Abandonado                  | sin `Query`                                           | Medio      |
| 21  | Cross | Enums/mappers duplicados                              | FE `packages/domain` vs BE `gateway/graphql/common`                       | Duplicado                   | sin contrato compartido                               | Medio      |
| 22  | Both  | TODO/FIXME/`Not implemented`/código comentado         | —                                                                         | NO VERIFICABLE              | 0 hits                                                | Nulo       |

## NO son código muerto (verificado)

- `setProductRecipe` (resolver + controller + e2e), `createRider`, `riderLocation`, `updateRiderLocation`, `updateRiderVehicle`: tienen consumidores.

## Mayor riesgo

1. **Secreto versionado** `apps/store/.env.native` (rotar y desversionar).
2. **Features backend sin consumidor** (zonas, turnos, deliveryOrders, StockMovement): aparecen "listas" pero son inalcanzables.
3. **Documentación stale** (`STATUS.md`): un agente/LLM podría reintroducir código muerto o buscar archivos inexistentes.
4. **Duplicación estructural** de enums/mappers entre repos → divergencia silenciosa.
