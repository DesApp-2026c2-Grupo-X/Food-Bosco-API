# AUDITORÍA DE AUTENTICACIÓN, ROLES Y SEGURIDAD — Food-Bosco

> **Estado:** HISTÓRICO — hallazgos de auditoría de solo lectura (2026-10-06). Correcciones aplicadas en [`15-INFORME-CORRECCIONES.md`](15-INFORME-CORRECCIONES.md).

## 1. Flujos de autenticación

- **Login:** FE → `LOGIN` → gateway → `POST /v1/auth/login` → `AuthOrchestrator.login` → `verifyCredentials` (bcrypt).
- **Registro:** rol forzado en servidor (`auth.orchestrator.ts:30-41`).
- **Refresh:** rotación de refresh token (revoca el usado) (`refresh-token.service.ts:28`).
- **Logout:** FE limpia estado; BE `revokeAll(userId)`.
- **Recovery:** token hasheado, 1h de expiración, un solo uso, intervalo mínimo 60s, respuesta neutral.
- **Hashing:** bcryptjs, 10 rondas (`user.service.ts`).
- **Error genérico:** mismo código/mensaje para email inexistente y contraseña incorrecta.

## 2. Modelo de roles

| Concepto | FE                                           | GraphQL                                      | BE                                           |
| -------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Valores  | `customer, branch_admin, super_admin, rider` | `CUSTOMER, BRANCH_ADMIN, SUPER_ADMIN, RIDER` | `customer, branch_admin, super_admin, rider` |
| JWT      | —                                            | —                                            | `roles:[user.role]`                          |

Consistente con mapeo. `super_admin` **no** satisface implícitamente `branch_admin`; los endpoints de sucursal listan ambos roles.

## 3. Guards de ruta vs autorización de endpoint (resumen)

- Admin (`super_admin`), branch (`branch_admin`), rider (`rider`), store (autenticado sin rol) — todos con RBAC server-side.
- Patrón "FE oculta / BE permite": solo lecturas de catálogo/sucursal/zona/shift/ingrediente-detalle que son públicas.
- Scope verificado: `assertBranchAccess`, `resolveBranchId`, ownership de rider y cliente.

## 4. Hallazgos

| #   | Hallazgo                                                                      | Repo  | Evidencia                                       | Severidad  |
| --- | ----------------------------------------------------------------------------- | ----- | ----------------------------------------------- | ---------- |
| S1  | `POST /seed` del gateway **sin guard**                                        | BE    | `gateway/src/seed/seed.controller.ts:33`        | 🔴 Crítica |
| S2  | Seed crea `super_admin` con password default `Admin123!`                      | BE    | `auth/config/env.ts:52`, `seed.service.ts`      | 🔴 Crítica |
| S3  | Default `INTERNAL_API_TOKEN='dev-internal-token'`; `@Internal()` bypassa RBAC | BE    | `apps/*/src/config/env.ts`, `roles.guard.ts:48` | 🟠 Alta    |
| S4  | Default `JWT_SECRET='dev-secret-change-me'`                                   | BE    | `apps/*/src/config/env.ts`                      | 🟠 Alta    |
| S5  | `@Internal` permite mutar `changeOrderStatus` de cualquier orden              | BE    | `order.controller.ts:88`, `roles.guard.ts:48`   | 🟠 Alta    |
| S6  | `GET /v1/orders` del servicio sin `@Roles`                                    | BE    | `order.controller.ts:25-44`                     | 🟡 Media   |
| S7  | Logout no revoca server-side (carrera)                                        | FE/BE | `authStore.ts:100-103`                          | 🟡 Media   |
| S8  | Tokens en `localStorage` (XSS)                                                | FE    | `authStore.ts:138-146`                          | 🟡 Media   |
| S9  | Secreto real versionado (Geoapify)                                            | FE    | `apps/store/.env.native:3`                      | 🟡 Media   |
| S10 | CORS permisivo (`enableCors()` sin opciones)                                  | BE    | `*/src/main.ts`                                 | 🟢 Baja    |
| S11 | JWT sin pinning de algoritmo/issuer/audience                                  | BE    | `*/security/jwt.service.ts`                     | 🟢 Baja    |
| S12 | Backdoor `?forceAuth=true` persistido                                         | FE    | `RequireAuth/index.tsx:14`                      | 🟢 Baja    |
| S13 | Endpoints de lectura públicos (ingrediente/categoría/branch/zona/shift)       | BE    | controllers                                     | 🟡 Media   |
| S14 | Sin throttle en endpoints de auth del servicio (solo gateway)                 | BE    | `auth.controller.ts`                            | 🟢 Baja    |

## 5. Checks que PASAN

- Bcrypt con salt; error genérico de credenciales.
- Recovery token hasheado, single-use, expira, con min-interval y throttle en gateway.
- Reset revoca refresh tokens; refresh rota y revoca.
- RBAC server-side en los 3 servicios; no confían en headers de contexto.
- Branch scope, customer scope y rider scope aplicados.
- Upload solo `super_admin`.
- `.env` de backend no trackeados.

## 6. NO VERIFICABLE

- Exposición de red de los puertos 4201/4202/4203.
- Uso real de secretos en disco (Atlas/CloudAMQP) en despliegue.
- Orden exacto de la carrera de logout en runtime.

## 7. Prioridades

1. **S1/S2**: proteger `/seed`, quitar credenciales seed default.
2. **S3/S4**: secretos fuertes obligatorios en producción.
3. **S6**: `@Roles` en `GET /v1/orders`.
4. **S9**: rotar y desversionar clave Geoapify.
5. **S5/S7/S8/S13**: endurecer en la siguiente iteración.
