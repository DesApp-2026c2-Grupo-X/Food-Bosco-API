# Plan — Autenticación (Auth Service + API Gateway)

> Documento consolidado que unifica `propuesta.md`, `plan2.md`, `resumen-sesion.md` y
> `pendings.md` en un único plan, sin perder contenido.

**Fecha:** 2026-08-18

**Fuentes de verdad:**

- `../requerimientos-backend-rest.md` §3, §4, §6, §10, §11.1, §12, §13, §15
- `../requerimientos-frontend.md` §1–§13 (clientes: Auth, Tienda, Admin sucursal, Admin global, Repartidor)

---

## 0. Objetivo del plan

Entregar **de punta a punta** la parte de autenticación para que los cinco frontends puedan
consumirla:

1. **Auth Service** (`../../apps/auth`, puerto `4201`) — implementación completa (identidad, sesión, roles, direcciones, recuperación).
2. **API Gateway** (`../../apps/gateway`, puerto `4000`) — extensión del esquema GraphQL y sus resolvers para exponer las operaciones de autenticación/usuarios/direcciones, traduciendo a REST contra el Auth Service.

El gateway ya tiene la infraestructura transversal lista (JWT/RBAC, rate limiting, `RestClient`,
`DataLoader`, formateo de errores, health, `requestId`). La extensión consiste en **definir el
esquema GraphQL del dominio auth y sus resolvers**, reutilizando esa infraestructura.

---

## 1. Decisiones confirmadas por el equipo

| Tema                                  | Decisión                                                           |
| ------------------------------------- | ------------------------------------------------------------------ |
| Hash de contraseña                    | `bcryptjs`                                                         |
| Refresh/recovery tokens               | almacenados hasheados (SHA-256)                                    |
| Validación de sucursal (`RQ-AUTH-13`) | **no se valida por ahora** → registrado en pendientes              |
| Acceso interno `GET /v1/users/{id}`   | header `X-Internal-Token` (`INTERNAL_API_TOKEN`)                   |
| Seed del `super_admin`                | script standalone (`npm run seed`)                                 |
| `PageInfo` en GraphQL                 | sí, `users` devuelve `UserPage { data, pageInfo }`                 |
| Auto-registro de repartidores         | sí, mutation `registerRider` (REST `POST /v1/auth/register-rider`) |
| Alcance del gateway                   | solo el dominio auth (Commerce/Delivery quedan para después)       |

---

# PARTE 1 — Auth Service

## 1.1 Alcance

Implementar el **Auth Service** completo (puerto `4201`), dueño de la identidad, la
autenticación, las sesiones, los roles, las direcciones del usuario y la recuperación de
contraseña. Es el único servicio que emite y valida JWT. Expone API REST bajo `/v1`.

Se cubren los requerimientos `RQ-AUTH-01` a `RQ-AUTH-22`, más los transversales
`RQ-SEC-01/02/04/07/08`, `RQ-REST-04/07`, `NFR-01/02/05/07/08`.

**Queda fuera de esta tarea:**

- Tests (otro agente los escribe luego).
- GraphQL Gateway, Commerce Service y Delivery Service (ya existen esqueletos; no se tocan aquí).

## 1.2 Decisiones técnicas

| Tema                  | Decisión                                                                           | Motivo                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ODM                   | `@nestjs/mongoose` + `mongoose`                                                    | Estándar NestJS + MongoDB, modelos tipados con decoradores.                                         |
| Hash de contraseña    | `bcryptjs`                                                                         | Puro JS, sin compilación nativa (compatible Windows/Linux/CI). Requerimiento permite bcrypt/argon2. |
| JWT                   | `jsonwebtoken` (crudo, como el gateway)                                            | Consistencia con `../../apps/gateway`; el secreto se comparte (`JWT_SECRET`).                       |
| Validación            | `class-validator` + `class-transformer` con `ValidationPipe` global                | Validación de DTOs declarativa.                                                                     |
| Config                | módulo `config/env.ts` (como el gateway)                                           | Sin `@nestjs/config`; se lee `process.env` con defaults de desarrollo.                              |
| Refresh token         | opaco (`crypto.randomBytes`), almacenado **hasheado** (SHA-256) en `refreshTokens` | Revocable y sin secretos legibles en la BD.                                                         |
| Token de recuperación | opaco, hasheado, de un solo uso (`used`) con expiración                            | `RQ-SEC-08`.                                                                                        |
| HTTP a Commerce       | `fetch` nativo de Node 20 (sin dependencia)                                        | Validación de sucursal en `RQ-AUTH-13`.                                                             |
| IDs                   | `crypto.randomUUID()` / `ObjectId` de Mongoose                                     | Sin dependencia extra.                                                                              |

**Dependencias nuevas en `../../apps/auth/package.json`** (dependencies):

- `@nestjs/mongoose`, `mongoose`
- `bcryptjs`
- `jsonwebtoken` (+ `@types/jsonwebtoken` en dev)
- `class-validator`, `class-transformer`

## 1.3 Variables de entorno (las carga el usuario)

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
| `SEED_SUPER_ADMIN_*`           | (ver §1.8)                           | Credenciales del `super_admin` inicial por seed.              |

Se documentará en un `../../apps/auth/.env.example` (no se versiona `.env`; ya está en `../../.gitignore`).
También se actualizará `../../turbo.json` (`globalEnv`) con las variables nuevas que Turborepo
debe pasar a la app.

## 1.4 Estructura por dominio

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

## 1.5 Modelos de datos (MongoDB — colecciones de Auth Service)

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

## 1.6 Endpoints REST

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

## 1.7 Seguridad

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

## 1.8 Seed del `super_admin` inicial (`RQ-AUTH-12`)

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

## 1.9 Manejo de errores

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

# PARTE 2 — Extensión del API Gateway

## 2.1 Estado actual del gateway (qué ya existe y se reutiliza)

| Pieza                              | Archivo(s)                                     | Estado                                                                           |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Bootstrap + CORS                   | `src/main.ts`                                  | listo                                                                            |
| Config env                         | `src/config/env.ts`                            | listo (`AUTH_SERVICE_URL` ya configurado)                                        |
| Constantes                         | `src/config/constants.ts`                      | listo (`ROLES`, `ERROR_CODES`, `HEADERS`)                                        |
| GraphQLModule (code-first, Apollo) | `src/gateway/gateway.module.ts`                | listo; usa `autoSchemaFile`                                                      |
| Contexto por request               | `src/gateway/gateway.context.ts`               | listo; verifica JWT y expone `userId/roles/branchId/authorization/requestId`     |
| Resolver placeholder               | `src/gateway/gateway.resolver.ts`              | **se reemplaza** (solo tiene `ping`)                                             |
| JWT + RBAC                         | `src/security/*`                               | listo; **se extiende** con "solo autenticado" (ver §2.7)                         |
| Cliente REST                       | `src/rest/rest.client.ts` + `rest.module.ts`   | listo; tokens `AUTH_REST_CLIENT`, `COMMERCE_REST_CLIENT`, `DELIVERY_REST_CLIENT` |
| DataLoader                         | `src/rest/data-loader.ts`                      | listo                                                                            |
| Rate limiting                      | `src/throttle/*`                               | listo                                                                            |
| Errores GraphQL                    | `src/observability/graphql-error-formatter.ts` | listo (mueve `extensions.code`)                                                  |
| Health                             | `src/health/*`                                 | listo                                                                            |
| requestId                          | `src/observability/request-id.middleware.ts`   | listo                                                                            |

## 2.2 Alcance de la extensión

Se implementa el **dominio de autenticación** del esquema GraphQL (el que tiene backend
funcional tras la Parte 1): `Auth/sesión`, `Usuarios/personal` y `Direcciones`. Es lo que los
cinco clientes necesitan hoy (T-01…T-04, T-16…T-18, G-12/G-13, y el login + `me` de Admin de
sucursal y Repartidor).

Los dominios `Catalog`, `Branch`, `Cart`, `Order`, `Stock`, `Reporting`, `Config` y `Delivery`
**quedan para después**, cuando existan Commerce Service y Delivery Service (mismo patrón de
resolver, ver Parte 4).

## 2.3 Estructura de archivos nuevos (gateway)

```text
apps/gateway/src/
├── security/
│   ├── authenticated.decorator.ts   # @Authenticated() — exige usuario logueado (cualquier rol)
│   ├── auth.guard.ts                # guard que valida el contexto autenticado
│   └── (roles.decorator.ts, roles.guard.ts, jwt.service.ts, security.module.ts — existentes)
├── graphql/
│   ├── common/
│   │   ├── role.enum.ts             # enum Role (CUSTOMER..RIDER) + mapeo <-> string
│   │   ├── page.ts                  # PageInput (limit/offset)
│   │   └── rest-context.ts          # helper GraphQLContext -> RestContext
│   └── auth/
│       ├── auth.types.ts            # @ObjectType User, Address, AuthTokens
│       ├── auth.inputs.ts           # @InputType RegisterInput, LoginInput, ...
│       ├── auth.resolver.ts         # Query + Mutation del dominio auth
│       └── auth.module.ts
└── gateway/
    ├── gateway.module.ts            # importa AuthGraphqlModule; elimina el resolver ping
    └── gateway.resolver.ts          # se elimina
```

Los resolvers/inputs/tipos viven en `graphql/<dominio>/` (organización por dominio de GraphQL,
equivalente a la organización por dominio de los servicios). `graphql/common/` reúne lo
compartido (enums, paginación, helper de contexto).

## 2.4 Esquema GraphQL a exponer (dominio auth)

Extraído de `../requerimientos-backend-rest.md` §4 (sin cambios de nombres).

```graphql
enum Role {
  CUSTOMER
  BRANCH_ADMIN
  SUPER_ADMIN
  RIDER
}

type AuthTokens {
  accessToken: String!
  refreshToken: String!
}

type User {
  id: ID!
  email: String!
  firstName: String!
  lastName: String!
  phone: String
  role: Role!
  active: Boolean!
  branchId: ID
  vehicle: String
}

type Address {
  id: ID!
  label: String!
  text: String!
  city: String
  postalCode: String
  latitude: Float!
  longitude: Float!
  active: Boolean!
}

type Query {
  me: User!
  users(filter: UserFilter, page: PageInput): [User!]!
  user(id: ID!): User!
  myAddresses: [Address!]!
  address(id: ID!): Address!
}

type Mutation {
  register(input: RegisterInput!): AuthTokens!
  login(input: LoginInput!): AuthTokens!
  refreshToken(refreshToken: String!): AuthTokens!
  logout: Boolean!
  requestPasswordRecovery(email: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): Boolean!

  updateProfile(input: UpdateProfileInput!): User!

  createStaff(input: CreateStaffInput!): User!
  createAdmin(input: CreateAdminInput!): User!
  createRider(input: CreateRiderInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  setUserActive(id: ID!, active: Boolean!): User!

  createAddress(input: CreateAddressInput!): Address!
  updateAddress(id: ID!, input: UpdateAddressInput!): Address!
  deleteAddress(id: ID!): Boolean!
}

input RegisterInput {
  firstName: String!
  lastName: String!
  email: String!
  phone: String!
  password: String!
}
input LoginInput {
  email: String!
  password: String!
}
input UpdateProfileInput {
  firstName: String!
  lastName: String!
  phone: String!
}
input CreateStaffInput {
  firstName: String!
  lastName: String!
  email: String!
  phone: String!
  password: String!
  branchId: ID!
}
input CreateAdminInput {
  firstName: String!
  lastName: String!
  email: String!
  phone: String!
  password: String!
}
input CreateRiderInput {
  firstName: String!
  lastName: String!
  email: String!
  phone: String!
  password: String!
  vehicle: String!
}
input UpdateUserInput {
  firstName: String
  lastName: String
  phone: String
  branchId: ID
}
input CreateAddressInput {
  label: String!
  text: String!
  city: String
  postalCode: String
  latitude: Float!
  longitude: Float!
}
input UpdateAddressInput {
  label: String
  text: String
  city: String
  postalCode: String
  latitude: Float
  longitude: Float
}
input UserFilter {
  role: Role
  active: Boolean
  search: String
}
input PageInput {
  limit: Int
  offset: Int
}
```

## 2.5 Mapeo Resolver → REST

| Operación GraphQL         | REST                                                 | Acceso (gateway)                                    |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `register`                | `POST /v1/auth/register`                             | público                                             |
| `login`                   | `POST /v1/auth/login`                                | público                                             |
| `refreshToken`            | `POST /v1/auth/refresh`                              | público                                             |
| `logout`                  | `POST /v1/auth/logout`                               | autenticado                                         |
| `requestPasswordRecovery` | `POST /v1/auth/password-recovery`                    | público                                             |
| `resetPassword`           | `POST /v1/auth/reset-password`                       | público                                             |
| `me`                      | `GET /v1/me`                                         | autenticado                                         |
| `updateProfile`           | `PATCH /v1/me`                                       | autenticado                                         |
| `users`                   | `GET /v1/users?role=&active=&search=&limit=&offset=` | `super_admin`                                       |
| `user`                    | `GET /v1/users/{id}`                                 | `super_admin` (interno para resolver cross-service) |
| `createStaff`             | `POST /v1/users/staff`                               | `super_admin`                                       |
| `createAdmin`             | `POST /v1/users/admins`                              | `super_admin`                                       |
| `createRider`             | `POST /v1/users/riders`                              | `super_admin`                                       |
| `updateUser`              | `PATCH /v1/users/{id}`                               | `super_admin`                                       |
| `setUserActive`           | `PATCH /v1/users/{id}/active`                        | `super_admin`                                       |
| `myAddresses`             | `GET /v1/addresses`                                  | `customer`                                          |
| `address`                 | `GET /v1/addresses/{id}`                             | `customer`                                          |
| `createAddress`           | `POST /v1/addresses`                                 | `customer`                                          |
| `updateAddress`           | `PATCH /v1/addresses/{id}`                           | `customer`                                          |
| `deleteAddress`           | `DELETE /v1/addresses/{id}`                          | `customer`                                          |

## 2.6 Detalles de mapeo de datos

- **Rol:** GraphQL usa `enum Role` en mayúsculas (`CUSTOMER`); el REST/JWT usa minúsculas
  (`customer`). El resolver convierte en ambas direcciones (`role.enum.ts` expone `toEnum`/`fromEnum`).
- **`id`:** el REST expone `id` (serialización de `_id`); el resolver garantiza `id` presente
  (soporta `id ?? _id` por robustez).
- **Listas:** `users`/`myAddresses` mapean `response.data` → `[User!]`/`[Address!]` (se ignora
  `meta` por ahora; se puede exponer `PageInfo` más adelante si el cliente lo necesita).
- **Paginación/filtros:** `UserFilter` y `PageInput` se traducen a query string (`role`, `active`,
  `search`, `limit`, `offset`).
- **`logout`:** retorna `true` tras `POST /v1/auth/logout` (el servicio revoca el refresh token).
- **`requestPasswordRecovery`:** siempre `true` (el servicio responde neutral, `RQ-AUTH-09`).

## 2.7 Seguridad en el gateway

- El contexto ya verifica el JWT (`gateway.context.ts`): expone `authenticated`, `userId`, `roles`,
  `branchId`, `authorization`, `requestId`. Los resolvers pasan ese contexto al `RestClient`
  (que propaga `Authorization` + `X-User-Id`, `X-Roles`, `X-Branch-Id`, `X-Request-Id`).
- **Nuevo:** decorador `@Authenticated()` + `AuthGuard` para operaciones que exigen sesión sin
  importar el rol (`me`, `updateProfile`, `logout`). `@Roles(...)` + `RolesGuard` se usan para
  las que exigen un rol concreto (`customer`, `super_admin`).
- Acceso denegado → `UnauthorizedException`/`ForbiddenException`, que el formateador de errores
  ya traduce a `extensions.code` (`UNAUTHENTICATED` / `FORBIDDEN`).
- Los errores de negocio del Auth Service (envelope `{ code, message, path }`) llegan como
  `GraphQLError` con `extensions.code` gracias al `RestClient` existente.

## 2.8 Variables de entorno del gateway

Sin cambios respecto a lo existente (`JWT_SECRET`, `AUTH_SERVICE_URL`, `COMMERCE_SERVICE_URL`,
`DELIVERY_SERVICE_URL`, `THROTTLE_*`). Ya están en `../../turbo.json` (`globalEnv`).

**Nuevo en `../../turbo.json`:** se agregan las variables del Auth Service para que Turborepo las pase
a `../../apps/auth`: `MONGODB_URI`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
`PASSWORD_RECOVERY_EXPIRES_IN`, `COMMERCE_SERVICE_URL`, `INTERNAL_API_TOKEN`, `SEED_SUPER_ADMIN_*`.

## 2.9 Login compartido y drivers (repartidores)

- **`login` ya es compartido** para los cuatro roles (`customer`, `branch_admin`, `super_admin`,
  `rider`). No necesita parámetro de rol: el rol se deriva de la cuenta y vuelve en el JWT + `me`.
  La app de auth redirige según el `role` (frontend §3.1).
- **Los drivers no se auto-registran** con `register` (es solo cliente, `RQ-AUTH-01`). Se crean
  con `createRider` (`super_admin`) y luego usan **el mismo** `login`.
- **Parámetro extra opcional (`app` / `clientType`):** se acepta un campo opcional en `login`
  (y, si se desea, en `register`) solo con fines de observabilidad/analítica (ej. `store`,
  `admin`, `rider`, `auth`). **Nunca** se usa para decidir rol ni autorización (evita escalada de
  privilegios); no altera la lógica de negocio ni la respuesta.
- **Alternativa de auto-registro de riders (si se quiere):** fuera de la spec actual. Se
  resolvería con una mutation dedicada `registerRider` (con `vehicle`) o un `role` opcional en
  `register` restringido a `customer`/`rider` (nunca `super_admin`/`branch_admin`). Ver anexo, pregunta 5.

---

# PARTE 3 — Verificación (sin tests)

```bash
npm install
npm run build       # compila apps/auth y apps/gateway
npm run typecheck   # tsc --noEmit en ambos
npm run lint        # eslint --max-warnings 0 en ambos
```

Smoke-test manual end-to-end:

```bash
npm run dev                      # levanta auth (4201) + gateway (4000)
# en el playground GraphQL (http://localhost:4000/graphql):
#   mutation { register(...) } / login(...)
#   query { me }
#   query { myAddresses }
#   mutation { createAddress(...) }
```

Los tests (unitarios y e2e de auth, y specs de los nuevos resolvers) quedan para el siguiente
agente. Se mantienen intactos los specs existentes del gateway.

---

# PARTE 4 — Roadmap (fuera de este plan)

Con el mismo patrón de resolvers (traducir a REST vía `RestClient`), en futuras iteraciones se
agregarán al gateway los dominios:

- `Catalog`, `Branch`, `Cart`, `Order`, `Stock`, `Reporting`, `Config` → contra Commerce Service.
- `Delivery` → contra Delivery Service.
- Campos cross-service (`Order.client`, `Order.branch`, `Product.category`, `RecipeItem.ingredient`,
  `CartItem.product`, `TripOrder.order`) resueltos con `DataLoader` por request (la infra ya existe).

---

# PARTE 5 — Resultado de la implementación

Resumen de lo efectivamente implementado (Auth Service + Gateway + tests).

## 5.1 Auth Service (`../../apps/auth`, puerto 4201)

Arquitectura por dominio (controller → servicio primario/orchestrator → repositorio → Mongo).

```
apps/auth/src/
├── config/          env, constants, crypto, database, security (JWT/RBAC), exceptions, request-id
├── health/          GET /health
├── user/            modelo users, UserService/Repository, UserController (/v1/users), MeController (/v1/me)
├── auth/            AuthController (/v1/auth) + AuthOrchestrator
├── refresh-token/   modelo refreshTokens + servicio
├── password-recovery/ modelo passwordRecovery + servicio
├── address/         modelo addresses + servicio + controller (/v1/addresses)
└── seed/            SeedService + seed.ts (npm run seed)
```

- **Colecciones MongoDB** (base `fastfood`): `users`, `refreshTokens`, `passwordRecovery`, `addresses`.
- **Seguridad**: bcryptjs, SHA-256 para tokens, JWT `{ userId, roles, branchId }`, RBAC con `@Roles`/`@Authenticated`/`@Internal`, envelope de errores RFC 7807.
- **Dependencias nuevas**: `@nestjs/mongoose`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `class-validator`, `class-transformer`.
- `.env.example` creado y `../../turbo.json` (`globalEnv`) actualizado.

### Endpoints REST (final)

`register`, `register-rider`, `login`, `refresh`, `logout`, `password-recovery`, `reset-password` (bajo `/v1/auth`); `GET/PATCH /v1/me`; `GET/POST/PATCH /v1/users` + `staff`/`admins`/`riders` + `/{id}/active`; `GET/POST/PATCH/DELETE /v1/addresses`; `GET /health`.

## 5.2 API Gateway (`../../apps/gateway`, puerto 4000)

- Dominio auth del esquema GraphQL: tipos `User`, `Address`, `AuthTokens`, `UserPage`, `PageInfo`; enum `Role`; 5 queries y 16 mutations + `registerRider`; 12 inputs.
- `graphql/auth/auth.resolver.ts` traduce a REST vía `RestClient` (mapeo `_id`→`id`, `Role` enum↔string, `{data,meta}`→`UserPage`).
- Nuevos `@Authenticated()` + `AuthGuard` (GraphQL-aware), reutilizando `@Roles` y el contexto JWT existente.
- Se eliminó el resolver placeholder `ping`.

## 5.3 Tests

| Suite        | Ubicación                                                      | Cantidad |
| ------------ | -------------------------------------------------------------- | -------- |
| Auth unit    | `apps/auth/src/**/*.spec.ts`                                   | 61       |
| Auth e2e     | `../../apps/auth/test/app.e2e-spec.ts` (mongodb-memory-server) | 26       |
| Gateway unit | `apps/gateway/src/**/*.spec.ts`                                | 60       |
| Gateway e2e  | `../../apps/gateway/test/auth.e2e-spec.ts` (fetch mockeado)    | 8        |

- **Auth unit**: servicios, orchestrator, guard, JWT, filtro de errores (parametrizados).
- **Auth e2e**: flujo HTTP real contra Mongo en memoria (registro→login→me→refresh→logout→recuperación→reset→direcciones→alta de personal→listado→activar/desactivar→403/401→acceso interno→register-rider).
- **Gateway e2e**: boot real del GraphQL verificando que los frontends pueden consumir (login, register-rider, `me` con/sin JWT, `users` con `pageInfo`, RBAC, `myAddresses`).

Cobertura de requerimientos: `RQ-AUTH-01..22`, `RQ-SEC-01/02/04/07/08`, `RQ-REST-07`, `NFR-05`.

## 5.4 Bugs reales detectados por los tests (y corregidos)

1. `user.model.ts` — `role`/`branchId`/`vehicle` (tipos unión) requerían `type: String` explícito en `@Prop`; sin eso el schema fallaba al cargar en runtime.
2. `auth.resolver.ts` — `users` requería `type: () => UserFilterInput`/`PageInput` en los `@Args` nullable.
3. `auth.controller.ts` — se agregó `@HttpCode(200)` a login/refresh/logout/password-recovery/reset-password (devolvían 201).

## 5.5 Verificación final

```
npm run typecheck   ✔
npm run lint        ✔
npm run build       ✔
npm run test        ✔  (123 tests)
npm run test:e2e    ✔  (34 tests, por app)
```

---

# PARTE 6 — Pendientes

Temas de la implementación que quedan abiertos a propósito. Cada entrada referencia el
requerimiento o la decisión, y qué falta.

| #   | Tema                                           | Referencia      | Qué falta                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Validación de sucursal al crear `branch_admin` | `RQ-AUTH-13`    | No se valida la sucursal contra Commerce Service vía REST por ahora (decisión del equipo). Cuando se active: extraer la creación de personal a un orchestrator + un cliente HTTP a `GET /v1/branches/{branchId}` (`COMMERCE_SERVICE_URL` ya está en `config/env.ts`). |
| 2   | Envío de token de recuperación                 | `RQ-AUTH-09/10` | El token de recuperación se genera y guarda, pero **no se envía** (no hay servicio de email en el alcance). El endpoint responde neutral como exige la spec.                                                                                                          |
| 3   | Acceso "interno" a `GET /v1/users/{id}`        | `RQ-AUTH-17`    | Soportado vía header `X-Internal-Token` (`INTERNAL_API_TOKEN`) además de `super_admin`. El gateway lo usará para resolver `Order.client` cuando exista Commerce.                                                                                                      |
| 4   | Resolvers de Commerce/Delivery en el gateway   | Parte 4         | Solo se implementó el dominio auth del esquema GraphQL. Catalog/Branch/Cart/Order/Stock/Reporting/Config/Delivery quedan para cuando existan sus servicios.                                                                                                           |
| 5   | `PageInfo` en GraphQL                          | §2.6            | Se expone `UserPage { data, pageInfo }` para `users`. `myAddresses` queda como lista simple (sin paginación).                                                                                                                                                         |

---

# Anexo — Preguntas planteadas durante la planificación

Preguntas originales de la propuesta y del plan; resueltas según la tabla de decisiones (§1).

### A. Propuesta (Auth Service)

1. **Hash de contraseña:** ¿`bcryptjs` (recomendado, puro JS) o `bcrypt` nativo?
2. **Refresh token hasheado en BD:** ¿confirmás almacenar SHA-256 (recomendado) o preferís
   el token crudo por simplicidad?
3. **Validación de sucursal (`RQ-AUTH-13`):** ¿incluyo ahora el `commerce.client.ts` que
   llama a `GET /v1/branches/{id}` (recomendado), o lo dejo mockeado/deshabilitado hasta
   que Commerce esté listo?
4. **Acceso interno a `GET /v1/users/{id}`:** ¿aceptás el header `X-Internal-Token`
   (`INTERNAL_API_TOKEN`) para el gateway, además de `super_admin`?
5. **Seed:** ¿script standalone `npm run seed` (recomendado) o auto-seed al arrancar la app?

### B. Plan 2 (Gateway)

1. **Alcance del gateway ahora:** ¿implemento solo el dominio auth (recomendado, es lo que tiene
   backend funcional) y dejo Commerce/Delivery para después, o querés el esquema GraphQL completo
   con resolvers de todos los dominios (aunque Commerce/Delivery REST aún no existan)?
2. **Auth Service:** confirmar las 5 decisiones de la propuesta (bcryptjs, refresh
   token hasheado, validación de sucursal vía REST, acceso interno `X-Internal-Token`, seed standalone).
3. **`user(id)` del gateway:** por ahora `super_admin`; el acceso "interno" para resolver
   `Order.client` se habilita cuando exista Commerce (¿ok?).
4. **Paginación en GraphQL:** ¿expongo `PageInfo` (total/limit/offset) junto a `users`, o dejo
   `[User!]` simple y agrego `PageInfo` cuando el frontend haga "cargar más"? (Recomendado: simple ahora.)
5. **Drivers (repartidores):** ¿los riders se auto-registran desde la app (nueva mutation
   `registerRider` o `role` opcional en `register` restringido a `customer`/`rider`), o se
   mantiene la spec (solo `super_admin` los crea y después usan el `login` compartido)?
   Recomendado: mantener la spec; si lo necesitás, agrego `registerRider`.
