# Plan 2 — Módulo de Autenticación + Extensión del API Gateway

**Fecha:** 2026-08-18
**Estado:** pendiente de confirmación
**Reemplaza:** `docs/propuesta.md` (este plan es la versión actualizada y completa)

**Fuentes de verdad:**

- `docs/requerimientos-backend-rest.md` §3, §4, §6, §10, §11.1, §12, §13, §15
- `docs/requerimientos-frontend.md` §1–§13 (clientes: Auth, Tienda, Admin sucursal, Admin global, Repartidor)

---

## 0. Objetivo del plan

Entregar **de punta a punta** la parte de autenticación para que los cinco frontends puedan
consumirla:

1. **Auth Service** (`apps/auth`, puerto `4201`) — implementación completa (identidad, sesión, roles, direcciones, recuperación). _(detalle completo en `docs/propuesta.md`)_
2. **API Gateway** (`apps/gateway`, puerto `4000`) — extensión del esquema GraphQL y sus resolvers para exponer las operaciones de autenticación/usuarios/direcciones, traduciendo a REST contra el Auth Service.

El gateway ya tiene la infraestructura transversal lista (JWT/RBAC, rate limiting, `RestClient`,
`DataLoader`, formateo de errores, health, `requestId`). La extensión consiste en **definir el
esquema GraphQL del dominio auth y sus resolvers**, reutilizando esa infraestructura.

---

# PARTE 1 — Auth Service

Se mantiene exactamente como está en `docs/propuesta.md` (estructura por dominio, 4 colecciones,
19 endpoints REST, seed, errores RFC 7807). Resumen de los puntos que impactan al gateway:

- REST base: `http://localhost:4201/v1`.
- Endpoints clave (ver tabla de mapeo en §3.3 de este plan).
- Listas devuelven `{ data, meta: { total, limit, offset } }`.
- El JWT access lo emite Auth Service y el gateway **solo lo verifica** (secreto compartido `JWT_SECRET`).
- El rol viaja en el JWT como `roles: [string]` (valores en minúscula: `customer`, `branch_admin`, `super_admin`, `rider`).

_No se repite aquí el detalle de `propuesta.md`; sigue vigente para toda la Parte 1._

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
| JWT + RBAC                         | `src/security/*`                               | listo; **se extiende** con "solo autenticado" (ver §3.4)                         |
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
resolver, ver §5 Roadmap).

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

Extraído de `requerimientos-backend-rest.md` §4 (sin cambios de nombres).

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
`DELIVERY_SERVICE_URL`, `THROTTLE_*`). Ya están en `turbo.json` (`globalEnv`).

**Nuevo en `turbo.json`:** se agregan las variables del Auth Service para que Turborepo las pase
a `apps/auth`: `MONGODB_URI`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
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
  `register` restringido a `customer`/`rider` (nunca `super_admin`/`branch_admin`). Ver pregunta 5.

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

# PARTE 5 — Preguntas para confirmar

1. **Alcance del gateway ahora:** ¿implemento solo el dominio auth (recomendado, es lo que tiene
   backend funcional) y dejo Commerce/Delivery para después, o querés el esquema GraphQL completo
   con resolvers de todos los dominios (aunque Commerce/Delivery REST aún no existan)?
2. **Auth Service:** confirmar las 5 decisiones de `docs/propuesta.md` §11 (bcryptjs, refresh
   token hasheado, validación de sucursal vía REST, acceso interno `X-Internal-Token`, seed standalone).
3. **`user(id)` del gateway:** por ahora `super_admin`; el acceso "interno" para resolver
   `Order.client` se habilita cuando exista Commerce (¿ok?).
4. **Paginación en GraphQL:** ¿expongo `PageInfo` (total/limit/offset) junto a `users`, o dejo
   `[User!]` simple y agrego `PageInfo` cuando el frontend haga "cargar más"? (Recomendado: simple ahora.)
5. **Drivers (repartidores):** ¿los riders se auto-registran desde la app (nueva mutation
   `registerRider` o `role` opcional en `register` restringido a `customer`/`rider`), o se
   mantiene la spec (solo `super_admin` los crea y después usan el `login` compartido)?
   Recomendado: mantener la spec; si lo necesitás, agrego `registerRider`.

---

**Confirmación:** al aprobar, implemento Partes 1 y 2 siguiendo este plan (y `propuesta.md` para la Parte 1).
