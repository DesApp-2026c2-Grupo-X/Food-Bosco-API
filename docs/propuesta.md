# Propuesta — Módulo de Autenticación (`apps/auth`)

**Fecha:** 2026-08-18
**Estado:** pendiente de confirmación
**Fuente de verdad:** `docs/requerimientos-backend-rest.md` §3, §6, §10, §11.1, §12, §13

---

## 1. Alcance

Implementar el **Auth Service** completo (puerto `4201`), dueño de la identidad, la
autenticación, las sesiones, los roles, las direcciones del usuario y la recuperación de
contraseña. Es el único servicio que emite y valida JWT. Expone API REST bajo `/v1`.

Se cubren los requerimientos `RQ-AUTH-01` a `RQ-AUTH-22`, más los transversales
`RQ-SEC-01/02/04/07/08`, `RQ-REST-04/07`, `NFR-01/02/05/07/08`.

**Queda fuera de esta tarea:**

- Tests (otro agente los escribe luego).
- GraphQL Gateway, Commerce Service y Delivery Service (ya existen esqueletos; no se tocan aquí).

---

## 2. Decisiones técnicas

| Tema                  | Decisión                                                                           | Motivo                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ODM                   | `@nestjs/mongoose` + `mongoose`                                                    | Estándar NestJS + MongoDB, modelos tipados con decoradores.                                         |
| Hash de contraseña    | `bcryptjs`                                                                         | Puro JS, sin compilación nativa (compatible Windows/Linux/CI). Requerimiento permite bcrypt/argon2. |
| JWT                   | `jsonwebtoken` (crudo, como el gateway)                                            | Consistencia con `apps/gateway`; el secreto se comparte (`JWT_SECRET`).                             |
| Validación            | `class-validator` + `class-transformer` con `ValidationPipe` global                | Validación de DTOs declarativa.                                                                     |
| Config                | módulo `config/env.ts` (como el gateway)                                           | Sin `@nestjs/config`; se lee `process.env` con defaults de desarrollo.                              |
| Refresh token         | opaco (`crypto.randomBytes`), almacenado **hasheado** (SHA-256) en `refreshTokens` | Revocable y sin secretos legibles en la BD.                                                         |
| Token de recuperación | opaco, hasheado, de un solo uso (`used`) con expiración                            | `RQ-SEC-08`.                                                                                        |
| HTTP a Commerce       | `fetch` nativo de Node 20 (sin dependencia)                                        | Validación de sucursal en `RQ-AUTH-13`.                                                             |
| IDs                   | `crypto.randomUUID()` / `ObjectId` de Mongoose                                     | Sin dependencia extra.                                                                              |

**Dependencias nuevas en `apps/auth/package.json`** (dependencies):

- `@nestjs/mongoose`, `mongoose`
- `bcryptjs`
- `jsonwebtoken` (+ `@types/jsonwebtoken` en dev)
- `class-validator`, `class-transformer`

---

## 3. Variables de entorno (las carga el usuario)

| Variable                       | Default (dev)                        | Uso                                                           |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------- |
| `PORT`                         | `4201`                               | Puerto HTTP.                                                  |
| `MONGODB_URI`                  | `mongodb://localhost:27017/fastfood` | Cadena de conexión a MongoDB (la provee el usuario).          |
| `JWT_SECRET`                   | `dev-secret-change-me`               | Secreto compartido con el gateway.                            |
| `JWT_ACCESS_EXPIRES_IN`        | `15m`                                | Vida del access token.                                        |
| `JWT_REFRESH_EXPIRES_IN`       | `7d`                                 | Vida del refresh token.                                       |
| `PASSWORD_RECOVERY_EXPIRES_IN` | `1h`                                 | Vida del token de recuperación.                               |
| `COMMERCE_SERVICE_URL`         | `http://localhost:4202`              | Validación de sucursal (`RQ-AUTH-13`).                        |
| `INTERNAL_API_TOKEN`           | `dev-internal-token`                 | Token para acceso "interno" (gateway) a `GET /v1/users/{id}`. |
| `SEED_SUPER_ADMIN_*`           | (ver §8)                             | Credenciales del `super_admin` inicial por seed.              |

Se documentará en un `apps/auth/.env.example` (no se versiona `.env`; ya está en `.gitignore`).
También se actualizará `turbo.json` (`globalEnv`) con las variables nuevas que Turborepo
debe pasar a la app.

---

## 4. Estructura por dominio

Sigue la skill `orchestrator-domain-architecture` (dominio → `controller` → `orchestrator`/`servicio primario` → `repository` → BD).

```text
apps/auth/src/
├── main.ts                          # bootstrap + ValidationPipe global + prefijo /v1
├── app.module.ts                    # orquesta los módulos de dominio + DB + middleware requestId
├── config/
│   ├── env.ts                       # env centralizado (como el gateway)
│   ├── constants.ts                 # ROLES, ERROR_CODES, HEADERS
│   ├── database/
│   │   └── database.module.ts       # MongooseModule.forRootAsync(uri de env)
│   ├── security/
│   │   ├── jwt.service.ts           # sign/verify access token (y tipos de payload)
│   │   ├── roles.decorator.ts       # @Roles(...)
│   │   ├── roles.guard.ts           # verifica JWT + RBAC, puebla request.user
│   │   ├── current-user.decorator.ts# @CurrentUser()
│   │   └── security.module.ts
│   ├── exceptions/
│   │   ├── domain.exception.ts      # errores de negocio (code, message)
│   │   └── http-exception.filter.ts # envelope { code, message, path } (RFC 7807)
│   ├── http/
│   │   └── commerce.client.ts       # GET /v1/branches/{id} (validación de sucursal)
│   └── observability/
│       └── request-id.middleware.ts # requestId correlacionado (NFR-03)
├── health/
│   ├── health.controller.ts         # GET /health (RQ-REST-04, NFR-08)
│   └── health.module.ts
├── user/                            # DOMINIO DE NEGOCIO — entidad User
│   ├── user.model.ts                # schema + interfaz del DER
│   ├── user.repository.ts
│   ├── user.service.ts              # servicio primario (CRUD, hash, verificación, activación)
│   ├── user.controller.ts           # GET /users · GET /users/{id} · PATCH · PATCH /active
│   ├── me.controller.ts             # GET /me · PATCH /me
│   ├── user.module.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       ├── update-profile.dto.ts
│       ├── create-staff.dto.ts
│       ├── create-admin.dto.ts
│       ├── create-rider.dto.ts
│       ├── update-user.dto.ts
│       └── user-query.dto.ts
├── auth/                            # DOMINIO DE ORQUESTACIÓN — sesión
│   ├── auth.controller.ts           # POST /auth/register·login·refresh·logout·password-recovery·reset-password
│   ├── auth.orchestrator.ts         # coordina User + RefreshToken + PasswordRecovery + Jwt
│   ├── auth.module.ts
│   └── dto/
│       ├── refresh.dto.ts
│       ├── request-password-recovery.dto.ts
│       └── reset-password.dto.ts
├── refresh-token/                   # DOMINIO DE NEGOCIO — sesión persistida
│   ├── refresh-token.model.ts
│   ├── refresh-token.repository.ts
│   ├── refresh-token.service.ts     # emitir/validar/revocar refresh tokens
│   └── refresh-token.module.ts
├── password-recovery/               # DOMINIO DE NEGOCIO — recuperación
│   ├── password-recovery.model.ts
│   ├── password-recovery.repository.ts
│   ├── password-recovery.service.ts # crear/validar/consumir token
│   └── password-recovery.module.ts
├── user-management/                 # DOMINIO DE ORQUESTACIÓN — altas de personal
│   ├── user-management.controller.ts# POST /users/staff · /admins · /riders
│   ├── user-management.orchestrator.ts # valida sucursal (Commerce) + crea usuario
│   ├── user-management.module.ts
│   └── dto/
├── address/                         # DOMINIO DE NEGOCIO — direcciones
│   ├── address.model.ts
│   ├── address.repository.ts
│   ├── address.service.ts           # CRUD de direcciones propias
│   ├── address.controller.ts        # GET/POST /addresses · GET/PATCH/DELETE /addresses/{id}
│   ├── address.module.ts
│   └── dto/
│       ├── create-address.dto.ts
│       └── update-address.dto.ts
└── seed/
    ├── seed.ts                      # script standalone (npm run seed)
    └── seed.module.ts               # (reutiliza la conexión)
```

**Se eliminarán** los archivos esqueleto `app.controller.ts`, `app.service.ts` y
`app.controller.spec.ts` (quedan reemplazados por los dominios; el spec obsoleto rompería
`typecheck` y los tests los escribirá otro agente).

Regla de oro respetada: ningún servicio primario importa a otro servicio primario. Las
coordinaciones viven en `auth.orchestrator.ts` y `user-management.orchestrator.ts`.

---

## 5. Modelos de datos (MongoDB — colecciones de Auth Service)

Base `fastfood`. Colecciones según §11.1.

### `users`

```text
{
  _id: ObjectId,
  email: string (unique index),
  passwordHash: string (select:false),
  role: 'customer' | 'branch_admin' | 'super_admin' | 'rider',
  firstName: string,
  lastName: string,
  phone: string,
  active: boolean (default true),
  branchId: string | null (solo branch_admin),
  vehicle: string | null (solo rider),
  createdAt: Date
}
```

Índices (NFR-01): `email` único.

### `refreshTokens`

```text
{ _id, userId, tokenHash (unique), expiresAt, revoked (default false), createdAt }
```

Índices: `userId`, `tokenHash` único.

### `passwordRecovery`

```text
{ _id, userId, tokenHash, expiresAt, used (default false), createdAt }
```

Índices: `userId`.

### `addresses`

```text
{ _id, userId, label, text, city, postalCode, latitude, longitude, active (default true) }
```

Índices: `userId`.

Los `passwordHash` y `tokenHash` nunca se serializan en respuestas; el `passwordHash`
se marca `select: false` y se consulta explícitamente solo al validar credenciales o
cambiar contraseña.

---

## 6. Endpoints

| Método | Ruta                         | Acceso                  | Coordinación                                                              |
| ------ | ---------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| POST   | `/v1/auth/register`          | público                 | `AuthOrchestrator` → `UserService` + `RefreshTokenService` + `JwtService` |
| POST   | `/v1/auth/login`             | público                 | `AuthOrchestrator`                                                        |
| POST   | `/v1/auth/refresh`           | público                 | `AuthOrchestrator` → `RefreshTokenService` (rota el refresh)              |
| POST   | `/v1/auth/logout`            | autenticado             | `AuthOrchestrator` → `RefreshTokenService` (revoca)                       |
| POST   | `/v1/auth/password-recovery` | público                 | `AuthOrchestrator` (respuesta neutral, `RQ-AUTH-09`)                      |
| POST   | `/v1/auth/reset-password`    | público                 | `AuthOrchestrator` → `PasswordRecoveryService` (un solo uso)              |
| GET    | `/v1/me`                     | autenticado             | `MeController` → `UserService`                                            |
| PATCH  | `/v1/me`                     | autenticado             | `MeController` → `UserService`                                            |
| GET    | `/v1/users`                  | `super_admin`           | `UserController` → `UserService` (filtros + paginación `{data, meta}`)    |
| GET    | `/v1/users/{userId}`         | `super_admin` / interno | `UserController` → `UserService`                                          |
| POST   | `/v1/users/staff`            | `super_admin`           | `UserManagementOrchestrator` (valida sucursal)                            |
| POST   | `/v1/users/admins`           | `super_admin`           | `UserManagementOrchestrator`                                              |
| POST   | `/v1/users/riders`           | `super_admin`           | `UserManagementOrchestrator`                                              |
| PATCH  | `/v1/users/{userId}`         | `super_admin`           | `UserController` → `UserService`                                          |
| PATCH  | `/v1/users/{userId}/active`  | `super_admin`           | `UserController` → `UserService`                                          |
| GET    | `/v1/addresses`              | `customer`              | `AddressController` → `AddressService`                                    |
| POST   | `/v1/addresses`              | `customer`              | `AddressController` → `AddressService`                                    |
| GET    | `/v1/addresses/{addressId}`  | `customer`              | `AddressController` → `AddressService`                                    |
| PATCH  | `/v1/addresses/{addressId}`  | `customer`              | `AddressController` → `AddressService`                                    |
| DELETE | `/v1/addresses/{addressId}`  | `customer`              | `AddressController` → `AddressService` (desactiva)                        |
| GET    | `/health`                    | público                 | `HealthController`                                                        |

Notas:

- `GET /v1/users/{id}` "interno": además de `super_admin`, acepta header
  `X-Internal-Token` = `INTERNAL_API_TOKEN` (para que el gateway resuelva `Order.client`).
- Listas devuelven `{ data, meta: { total, limit, offset } }` (convención §5).
- `DELETE /addresses` hace **desactivación lógica** (`active=false`), sin borrado físico
  (consistente con `RQ-AUTH-16`).

---

## 7. Seguridad

- **JWT access**: payload `{ sub: userId, userId, roles: [role], branchId }`, firmado con
  `JWT_SECRET`, expiración `JWT_ACCESS_EXPIRES_IN`. `roles` como arreglo (compatible con el
  `JwtService` del gateway).
- **Refresh token**: opaco + hash SHA-256 en BD; `refresh` rota el token (revoca el usado y
  emite uno nuevo) y valida `expiresAt`/`revoked`.
- **Guard/RBAC**: `RolesGuard` verifica la firma del JWT (no confía en headers `X-*`) y
  aplica `@Roles(...)`; puebla `request.user` para `@CurrentUser()`.
- **Defensa en profundidad** (`RQ-SEC-04`): cada endpoint protegido declara su rol.
- **Sin secretos en logs** (`RQ-SEC-07`): ni contraseñas, ni hashes, ni tokens.
- **Email único** (`RQ-AUTH-02`): índice único + validación previa con error `EMAIL_TAKEN`.
- **Login genérico** (`RQ-AUTH-06`): error `INVALID_CREDENTIALS` sin distinguir causa.
- **Recuperación neutral** (`RQ-AUTH-09`): `password-recovery` siempre responde `{ ok: true }`.
- **Recuperación de un solo uso** (`RQ-SEC-08`): `used` se marca al consumir; el token
  expira por `PASSWORD_RECOVERY_EXPIRES_IN`.

---

## 8. Seed del `super_admin` inicial (`RQ-AUTH-12`)

Script standalone `npm run seed` (idempotente: upsert por email), que lee:

| Variable                      | Default (dev)           |
| ----------------------------- | ----------------------- |
| `SEED_SUPER_ADMIN_EMAIL`      | `admin@foodbosco.local` |
| `SEED_SUPER_ADMIN_PASSWORD`   | `Admin123!` (solo dev)  |
| `SEED_SUPER_ADMIN_FIRST_NAME` | `Super`                 |
| `SEED_SUPER_ADMIN_LAST_NAME`  | `Admin`                 |
| `SEED_SUPER_ADMIN_PHONE`      | `0000000000`            |

No se ejecuta en el arranque de la app (mantiene NFR-02 stateless); se corre manualmente o
por CI. En producción las credenciales vienen de secretos.

---

## 9. Manejo de errores

Envelope único (`RQ-REST-07`, `NFR-05`):

```json
{ "code": "INVALID_CREDENTIALS", "message": "Credenciales inválidas", "path": "/v1/auth/login" }
```

`HttpExceptionFilter` global traduce excepciones de dominio (`DomainException`) y las
excepciones HTTP de Nest a ese formato, con códigos de estado coherentes (400/401/403/404/409/500).
Catálogo inicial de códigos: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `USER_NOT_FOUND`,
`INVALID_REFRESH_TOKEN`, `INVALID_OR_EXPIRED_TOKEN`, `BRANCH_NOT_FOUND`, `ADDRESS_NOT_FOUND`,
`VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHENTICATED`, `INTERNAL`.

---

## 10. Verificación (sin tests)

Para validar el trabajo se correrá:

```bash
npm install
npm run build          # compila apps/auth (nest build)
npm run typecheck      # tsc --noEmit en apps/auth
npm run lint           # eslint --max-warnings 0 en apps/auth
```

Y se levantará `apps/auth` con `npm run dev` para smoke-test manual contra `GET /health`.
(Los tests quedan para el siguiente agente; se dejará la estructura lista para agregar `.spec.ts`.)

---

## 11. Preguntas para confirmar

1. **Hash de contraseña:** ¿`bcryptjs` (recomendado, puro JS) o `bcrypt` nativo?
2. **Refresh token hasheado en BD:** ¿confirmás almacenar SHA-256 (recomendado) o preferís
   el token crudo por simplicidad?
3. **Validación de sucursal (`RQ-AUTH-13`):** ¿incluyo ahora el `commerce.client.ts` que
   llama a `GET /v1/branches/{id}` (recomendado), o lo dejo mockeado/deshabilitado hasta
   que Commerce esté listo?
4. **Acceso interno a `GET /v1/users/{id}`:** ¿aceptás el header `X-Internal-Token`
   (`INTERNAL_API_TOKEN`) para el gateway, además de `super_admin`?
5. **Seed:** ¿script standalone `npm run seed` (recomendado) o auto-seed al arrancar la app?

---

**Confirmación:** al aprobar, arranco la implementación siguiendo esta propuesta.
