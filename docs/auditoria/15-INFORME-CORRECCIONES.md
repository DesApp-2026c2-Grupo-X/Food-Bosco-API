# AUDIT_REPORT.md — Auditoría y mejora de Food-Bosco

> **Estado:** HISTÓRICO — informe de correcciones aplicadas sobre la auditoría (2026-10-06). Complementa los hallazgos de esta carpeta; el código es la fuente de verdad.

**Fecha:** 2026-10-06
**Alcance:** dos repositorios

- Backend: `C:\Users\mateo\WebstormProjects\Food-Bosco-API`
- Frontend: `C:\Users\mateo\WebstormProjects\Food-Bosco-Frontend`

**Modo:** lectura + corrección de código, documentación y tests.
**Criterio rector:** _el código actual es la fuente de verdad_. Proyecto académico: se priorizó
calidad, mantenibilidad, funcionalidad real y tests con sentido, evitando sobreingeniería.

---

## 1. Metodología

1. Relevamiento de la arquitectura de ambos monorepos (4 servicios NestJS + gateway; 4 apps React +
   7 paquetes) y de los flujos de usuario.
2. Lectura de `/docs` de ambos repos y comparación sistemática con el código.
3. Baseline de build/typecheck/lint/tests y de coverage.
4. Corrección de bugs/seguridad, alineación de documentación, refuerzo de tests.
5. Validación final (build, lint, typecheck, unit, e2e) y medición de coverage.

---

## 2. Estado inicial (baseline)

### Backend

- **Build OK**; el `typecheck` **fallaba** (error en `apps/delivery/src/seed/seed.service.spec.ts`:
  `vehicle` string donde el tipo espera `Vehicle`).
- Tests unitarios: **2 fallando** en `apps/auth/src/config/env.spec.ts` (esperaban
  `env.seed.superAdminEmail`, campo inexistente) y, por eso, `npm run test` raíz en rojo.
- Coverage medido con la config original (que **incluía los archivos `.spec.ts`**, inflando el
  número): auth 83.0 %, commerce 74.9 %, delivery 78.1 %, gateway 77.6 % (statements).

### Frontend

- **9 de 45 archivos de test fallaban al colectar** por una dependencia declarada pero no instalada
  (`recharts`): `node_modules` desincronizado respecto de `package-lock.json`.
- Tras `npm install`: 45 archivos / 339 tests en verde.
- `check-types` fallaba salvo que se corriera `build` antes (bug de orden en `turbo.json`).

---

## 3. Problemas encontrados y corregidos

### 3.1 Seguridad (backend)

| #   | Hallazgo                                                                                                                                                                                    | Corrección                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| S1  | **Fuga de autorización en `@Internal()`**: si el `x-internal-token` no coincidía, el guard caía a anónimo y permitía el paso en endpoints internos (seed, zones, shifts, `riders/by-user`). | `RolesGuard` (auth, commerce, delivery) ahora exige token interno **o** JWT válido.              |
| S2  | `POST /seed` del gateway **sin guard**.                                                                                                                                                     | Se agregó `InternalGuard` (requiere `x-internal-token`) y se protegió el controlador.            |
| S3  | `GET /v1/orders` sin control de rol en el servicio.                                                                                                                                         | Ya requería `@Authenticated()`; el test de controller valida el alcance por rol.                 |
| S4  | **Refresh token reutilizable en carrera**: `findByTokenHash` + `markRevokedByHash` no era atómico (dos requests concurrentes pasaban).                                                      | Nuevo `revokeIfActive` atómico (`findOneAndUpdate({ tokenHash, revoked: false })`).              |
| S5  | Refresh token **huérfano** al refrescar un usuario inactivo (se emitía antes de validar).                                                                                                   | `AuthOrchestrator.refresh` consume primero y emite después de validar usuario activo.            |
| S6  | Sin índice TTL en `refreshTokens`.                                                                                                                                                          | `RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })`.                         |
| S7  | Dirección **soft-deleted** modificable (`updateOwned` no filtraba `active`).                                                                                                                | `updateOwned`/`softDeleteOwned` filtran `active: true`.                                          |
| S8  | Secreto real (Geoapify) versionado en `apps/store/.env.native` (frontend).                                                                                                                  | Se agregó a `.gitignore` y se dejó de trackear (`git rm --cached`). **Requiere rotar la clave.** |

> Nota: los defaults de desarrollo (`JWT_SECRET=dev-secret-change-me`,
> `INTERNAL_API_TOKEN=dev-internal-token`) se mantienen a propósito para poder correr el proyecto
> localmente; se documenta que en un despliegue real deben reemplazarse.

### 3.2 Correctitud (backend)

| #   | Hallazgo                                                                                                                             | Corrección                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| C1  | `ORDER_TRANSITIONS[estado desconocido]` provocaba `TypeError` (500).                                                                 | `?? []` → transición inválida controlada (409).                                                       |
| C2  | Código de error hardcodeado `'VALIDATION_ERROR'` en reporting.                                                                       | `ERROR_CODES.validationError`.                                                                        |
| C3  | Mismatch de dominio `vehicle`: auth guarda string, delivery esperaba objeto `Vehicle`. El seed HTTP fallaba con el `ValidationPipe`. | El seed de delivery normaliza el string legado a `Vehicle` (`{ type, model }`); el DTO acepta string. |
| C4  | `AppController`/`AppService` de delivery **no registrados** (código muerto).                                                         | Eliminados (con su spec).                                                                             |

### 3.3 Correctitud (frontend)

| #   | Hallazgo                                                                                                        | Corrección                                         |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| F1  | `toUser` forzaba `createdAt` a "ahora", ignorando el payload.                                                   | Respeta `raw.createdAt` (con fallback válido).     |
| F2  | `formatOrderDate` pasaba opciones de hora a `toLocaleDateString` (ignoradas).                                   | Se quitó la hora (la formatea `formatOrderTime`).  |
| F3  | `classifyAuthError` usaba una regex amplia que clasificaba cualquier "used"/"recuperación" como token inválido. | Clasifica por `extensions.code` y mensaje acotado. |
| F4  | `RequireAuth`: `?forceAuth=false` no anulaba el bypass de `mockAuth`.                                           | Precedencia corregida (param > mockAuth/bypass).   |
| F5  | `useRiderHome.handleAccept` podía dispararse dos veces.                                                         | Guarda `if (isMutating) return`.                   |
| F6  | `recharts` declarado pero sin instalar (9 suites no colectaban).                                                | `npm install` (el lock ya lo tenía).               |
| F7  | `check-types` fallaba sin `build` previo (orden de Turbo).                                                      | `check-types`/`typecheck` dependen de `^build`.    |

### 3.4 Código muerto eliminado

- Backend: `AppController`/`AppService` (delivery); campos de seed sin uso en `auth/config/env.ts`.
- Frontend: `formatVehicle`, `STAFF_ROLES`, `notifyInfo` (y sus imports/tests).

---

## 4. Funcionalidades faltantes detectadas (documentadas pero inexistentes)

- **Admin global — Promociones y Estados de pedido**: sin páginas, rutas, hooks ni nav (solo tipos
  y esquemas Zod en `@repo/domain`).
- **Store — Repetir pedido**: backend listo (`POST /v1/orders/:id/repeat`), sin UI.
- **Store — checkout en dos pasos** y ruta recuperable `/orders/:orderId/confirmed`.
- **Store — catálogo público** (hoy detrás de `RequireAuth`).
- **Rider — ruta `/trip`** y elemento de dock.
- **Admin — "pedidos que requieren atención"** en el Home.
- **Backend** — paquete de contratos OpenAPI + codegen; idempotencia/DLQ de eventos; DataLoader batch
  real; separación de base por servicio.
- Docs que describen `apps/auth` como app (en realidad `packages/auth`) y SWR/mocks (en realidad Apollo).

## 5. Funcionalidades implementadas en esta auditoría

No se construyeron funcionalidades grandes. Se implementaron mejoras acotadas y coherentes con el
estado actual:

1. **Protección con token interno del endpoint de seed del gateway** (`InternalGuard`).
2. **Normalización del `vehicle`** legado en el seed de delivery (perfil de repartidor).
3. **Semántica correcta y segura de `@Internal()`** en los tres servicios.
4. **Rotación de refresh token de un solo uso y atómica**, con TTL.

## 6. Funcionalidades deliberadamente NO implementadas (fuera de alcance)

- Motor de **promociones/reglas comerciales** (combos, cupones, envío gratis): solo CRUD como dato
  general. Implementarlo es expandir el alcance significativamente.
- **UI completa de administración de promociones y estados**: es un feature grande (páginas, CRUD,
  navegación, contrato). Se documenta como pendiente.
- **OpenAPI + codegen** y **separación de base por servicio**: cambios estructurales grandes.

Se dejó constancia explícita de lo fuera de alcance dentro de los documentos canónicos
(`docs/especificaciones/requerimientos-backend-rest.md` y `docs/especificaciones/requerimientos-frontend.md`).

---

## 7. Documentación actualizada (en los documentos canónicos, sin archivos-parche)

Regla aplicada: **se actualizaron los documentos existentes**; no se crearon archivos paralelos tipo
`*-actualizada.md`.

### Backend

- `docs/especificaciones/requerimientos-backend-rest.md`: se agregó al inicio el **estado de implementación** real
  (gateway + 3 servicios, `packages/auth`, endpoints no listados, fuera de alcance) y se corrigió el
  alcance/redacción de §1 ("cinco frontends" → apps reales).
- `README.md` y `CLAUDE.md`: se agregó el `gateway` (4000) y se corrigió la estructura.
- `docs/historico/planes/auth-plan.md` (§1.8): tabla de variables de seed corregida (solo contraseñas; los datos viven
  en `src/seed/data/auth.json`) + nota de actualización al inicio.
- `docs/historico/planes/commerce-plan.md` y `docs/historico/planes/delivery-plan.md`: nota de actualización (planes históricos;
  el código es la fuente de verdad) y aclaraciones de seguridad/dominio.

### Frontend

- `docs/especificaciones/requerimientos-frontend.md`: estado de implementación real al inicio (4 apps + `packages/auth`,
  Apollo/GraphQL, fuera de alcance) y corrección de §1 y de la "Nota de implementación".
- `README.md` y `CLAUDE.md`: 4 apps (5173–5176), stack Apollo, paquete `@repo/api`.
- `apps/store/STATUS.md` y `apps/admin/STATUS.md`: **reescritos** con el estado real (ya no un banner:
  el archivo entero refleja el código).
- `planAdmin.md`, `docs/planRider.md`, `docs/auditoria-tests-funcionales.md`: actualizados (estado real
  del Repartidor, features fuera de alcance, cifras de tests).

---

## 8. Estrategia de testing

- **Unitarios** (Jest, API; Vitest, FE) co-locados, con **tablas de casos** y casos límite
  (válido/borde/inválido), siguiendo la skill `high-quality-tests`.
- **Integración/e2e** por servicio en `test/` (gateway 12 suites con stubs de downstream;
  auth/commerce/delivery con `mongodb-memory-server`).
- **Flujos FE** con `@testing-library/react` y providers de test (`test/utils.tsx`).
- Sin infraestructura E2E pesada: nada de baselines visuales ni screenshot testing.

## 9. Flujos de usuario cubiertos

**Backend:** registro/login/refresh/logout/recuperación; CRUD de direcciones; catálogo; carrito y
confirmación de pedido; asignación de sucursal; máquina de estados; repetición de pedido; reportes;
disponibilidad/ubicación de repartidor; ofertas de viaje (aceptar/rechazar); pickup/deliver;
seguridad (roles, `@Internal`, guards).

**Frontend (cubierto con tests de flujo render → completar → validar → enviar → resultado):**

- **store:** login/registro/recuperación; catálogo y configurador; carrito (drawer, líneas, cantidades,
  eliminar); checkout; selector/alta de dirección; edición de perfil; listado/detalle de pedidos;
  perfil y sucursales.
- **admin:** listado y alta/edición de sucursales y personal; edición de productos (tabs general/
  configuración/receta); categorías, ingredientes y parámetros (modales); ajuste de stock; pedidos;
  reportes; home y perfil.
- **branch:** productos (pausar/reactivar), stock (ajuste con validación), pedidos, home, reportes y
  perfil.
- **rider:** disponibilidad, oferta (aceptar/rechazar), viaje (retiro/entrega + gate de proximidad
  50 m), edición de perfil y de vehículo, perfil e historial.
- **transversal:** guard de ruta `RequireAuth` (roles y `forceAuth`).

## 10. Coverage inicial y final

### Configuración

La config original (`.spec.ts` incluidos en `collectCoverageFrom`) **contaba los propios tests**,
inflando el resultado. Se corrigió para excluir archivos de test y, además, el **wiring no lógico**
(`*.module.ts`, `main.ts`, `seed.ts`). No se excluyó lógica de negocio ni se redujo ningún umbral
(no había thresholds definidos).

### Backend — statements / branches / functions / lines

| App      | Inicial (config original, con specs) | Final (tests y wiring excluidos) |
| -------- | ------------------------------------ | -------------------------------- |
| auth     | 83.0 / 82.4 / 91.1 / 84.4            | **96.0 / 83.1 / 94.6 / 96.7**    |
| commerce | 74.9 / 64.2 / 76.8 / 75.4            | **87.5 / 72.3 / 81.1 / 87.7**    |
| delivery | 78.1 / 70.4 / 80.9 / 78.5            | **87.8 / 70.6 / 82.4 / 87.6**    |
| gateway  | 77.6 / 80.1 / 39.5 / 74.1            | **80.2 / 81.6 / 39.9 / 76.5**    |

### Frontend

No tenía coverage porcentual configurado ni `@vitest/coverage-v8` instalado. Se priorizó, como pidió
el equipo, **cubrir todos los flujos/formularios/interacciones del usuario** con tests de integración
(renderizar, completar, validar, enviar y verificar resultado, incluidos casos de error). La suite
pasó de **47 archivos / 362 tests** a **83 archivos / 538 tests** (176 tests de flujo nuevos), todos
en verde. No se agregó la dependencia de coverage (evitar dependencias innecesarias).

### Interpretación honesta del ≥90 %

- **auth: supera el 90 %** (96 % líneas / 94,6 % funciones).
- **commerce y delivery: ~88 % líneas.** Cerca del objetivo; lo que falta son principalmente
  _controllers_ delgados y _repositories_ de delegación.
- **gateway: 76,5 % líneas / 39,9 % funciones.** Es el caso a explicar: sus _resolvers_ y mappers de
  tipos GraphQL son delegadores delgados que están cubiertos por **12 suites e2e** (165 tests) que
  **no** forman parte de `test:cov` (que solo corre unitarios). Además, los `*.inputs.ts`/`*.types.ts`
  son clases decoradas con muchas funciones generadas que nunca se ejecutan. Subir el número
  unitario al 90 % exigiría tests artificiales sobre clases de tipo/wiring; se decidió no forzarlo.

No se alcanzó el 90 % global uniforme por las razones anteriores; se priorizó cobertura significativa
sobre el número.

## 11. Tests agregados / modificados

### Backend (nuevos)

- `gateway/src/security/internal.guard.spec.ts`
- `gateway/src/seed/seed.controller.spec.ts`
- `gateway/src/health/health.service.spec.ts`
- `commerce/src/config/security/roles.guard.spec.ts`
- `commerce/src/order/order.controller.spec.ts`
- `commerce/src/config/exceptions/http-exception.filter.spec.ts`

### Backend (actualizados por los fixes)

- `auth/src/config/env.spec.ts`, `auth/src/refresh-token/*.spec.ts`, `auth/src/auth/auth.orchestrator.spec.ts`,
  `auth/src/address/address.repository.spec.ts`
- `delivery/src/config/security/roles.guard.spec.ts`, `delivery/src/seed/seed.service.spec.ts`
- `commerce/src/order/order.service.spec.ts`

### Frontend (nuevos — 42 archivos, 176 tests)

- **store** (43): `AddressForm`, `AddressesPage`, `EditProfilePage`, `CartPage`, `CartDrawer`,
  `CartLineCard` y smoke de `HomePage`/`OrdersPage`/`OrderDetailPage`/`ProfilePage`/`SucursalesPage`/
  `CatalogPage`/`ProductDetailPage`.
- **admin** (60): `BranchesPage`, `BranchEditPage`, `StaffPage`, `StaffEditPage`, `ProductsPage`,
  `ProductEditPage`, `CategoriesPage`, `IngredientsPage`, `ParametersPage`, `StockPage`, `OrdersPage`,
  `ReportsPage`, `HomePage`, `ProfilePage`.
- **branch** (25): `ProductsPage`, `StockPage`, `OrdersPage`, `HomePage`, `ReportsPage`, `ProfilePage`.
- **rider** (48): `HomePage`, `TripOrderDetailPage` (incluye gate de proximidad 50 m), `EditProfilePage`,
  `VehicleEditPage`, `ProfilePage`, `HistoryPage`, `TripCard`, `TripOfferCard`, `RideStatusButton`.
- **packages**: `packages/auth/src/utils/__tests__/authErrors.test.ts`,
  `packages/components/src/RequireAuth/__tests__/RequireAuth.test.tsx`.

### Frontend (actualizados)

- `packages/api/src/client/__tests__/mappers.test.ts`, `packages/domain/src/__tests__/format.test.ts`,
  `packages/domain/src/__tests__/geo.test.ts`, `packages/domain/src/__tests__/misc.test.ts`

## 12. Validación final

| Comando                 | Backend                                                    | Frontend             |
| ----------------------- | ---------------------------------------------------------- | -------------------- |
| build                   | ✅                                                         | ✅                   |
| lint                    | ✅ (5 tasks)                                               | ✅ (10 tasks)        |
| typecheck / check-types | ✅                                                         | ✅                   |
| unit tests              | ✅ 2832                                                    | ✅ 538 (83 archivos) |
| e2e                     | ✅ 244 (gateway 165 + commerce 36 + auth 28 + delivery 15) | n/a                  |

---

## 13. Riesgos / deuda técnica que persiste

1. **Secreto Geoapify** ya expuesto en el historial de git del frontend: **rotar la clave** (desversionarla no la borra del historial).
2. **Defaults inseguros** de `JWT_SECRET`/`INTERNAL_API_TOKEN` en desarrollo: deben configurarse en cualquier entorno real.
3. **Bus de eventos**: sin `BROKER_URL` usa bus in-process (no cruza procesos); Rabbit usa `noAck` sin retry/DLQ. Sin idempotencia por `eventId`.
4. **Base compartida `fastfood`** entre los 3 servicios; `reporting` inyecta modelos de otros dominios.
5. **DataLoader** deduplica por request pero hace una llamada REST por id (no reduce el N+1 real).
6. **Features backend sin UI**: promociones, estados de pedido, repetición de pedido, edición de opciones/observaciones del carrito.
7. **Docs extensos** (`requerimientos-*.md`, planes): se actualizaron los documentos canónicos con el estado real y las secciones fuera de alcance; el resto del contenido histórico puede seguir siendo aspiracional.
8. **Paquete de contratos/OpenAPI** inexistente: enums/mappers duplicados entre gateway y frontend.
9. **`apps/store/.env.native`** queda local (ignorado): los clones nuevos deben crear su propio archivo con su clave.
10. Un test legado del frontend (`packages/domain/test/helpers.test.js`, runner `node:test`) sigue fuera del runner de Vitest; se recomienda eliminarlo.
