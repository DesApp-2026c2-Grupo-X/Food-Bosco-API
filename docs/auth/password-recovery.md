# Recuperación y restablecimiento de contraseña

Implementación del flujo completo de recuperación de contraseña (Tarea 8) para el Auth Service
(`apps/auth`, puerto 4201) y su exposición GraphQL en el API Gateway (`apps/gateway`, puerto 4000).

- **Solicitud** (`requestPasswordRecovery`): genera un token, envía un email y responde neutral.
- **Restablecimiento** (`resetPassword`): valida el token, actualiza la contraseña y revoca sesiones.

---

## 1. Contrato GraphQL definitivo

El contrato implementado en el Gateway es el que ya estaba definido en
`docs/requerimientos-backend-rest.md` §4 y `docs/auth/plan.md` §2.4:

```graphql
type Mutation {
  requestPasswordRecovery(email: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): Boolean!
}
```

> **Nota sobre el nombre.** La consigna de la tarea propone `requestPasswordReset(email: String!): Boolean!`.
> El repositorio ya implementaba y documentaba `requestPasswordRecovery` (requerimiento `RQ-AUTH-09`,
> `docs/requerimientos-backend-rest.md` línea 567, `docs/auth/plan.md` línea 433 y la app de Auth del
> frontend, `docs/requerimientos-frontend.md` T-03). Para no romper compatibilidad ni duplicar
> operaciones, se mantiene `requestPasswordRecovery` como nombre definitivo. Si el frontend necesita
> `requestPasswordReset`, debe consumir `requestPasswordRecovery` con la misma firma.

Ambas mutaciones son **públicas** (no requieren `Authorization`) y están disponibles para las cuatro
aplicaciones (Store, Admin, Branch, Rider) porque el esquema GraphQL del Gateway es compartido.

### Mapeo REST (Gateway → Auth Service)

| Operación GraphQL         | REST                              | Acceso  | Throttle      |
| ------------------------- | --------------------------------- | ------- | ------------- |
| `requestPasswordRecovery` | `POST /v1/auth/password-recovery` | público | 5 req / 60 s  |
| `resetPassword`           | `POST /v1/auth/reset-password`    | público | 10 req / 60 s |

---

## 2. Flujo completo

```text
Frontend (Store/Admin/Branch/Rider)
  │  mutation requestPasswordRecovery(email)
  ▼
Gateway (GraphQL, público, throttle)
  │  POST /v1/auth/password-recovery { email }
  ▼
AuthOrchestrator.requestPasswordRecovery(email)
  ├─ UserService.findByEmail(email)          → si no existe: no hace nada (respuesta neutral)
  ├─ PasswordRecoveryService.create(userId)
  │    ├─ aplica intervalo mínimo anti-abuso (por usuario)
  │    ├─ invalida tokens activos anteriores
  │    ├─ genera token opaco criptográficamente seguro (32 bytes)
  │    └─ persiste SHA-256(token) + expiresAt (nunca el token crudo)
  ├─ EmailService.sendPasswordRecovery(...)  → proveedor de correo (Resend / log)
  │    └─ construye la URL del frontend desde la configuración del backend
  └─ responde 200 { ok: true } (sin revelar si el correo existe)

Usuario abre el enlace: FRONTEND_URL + PASSWORD_RESET_PATH + ?token=<token>

Frontend
  │  mutation resetPassword(token, newPassword)
  ▼
AuthOrchestrator.resetPassword(token, newPassword)
  ├─ PasswordRecoveryService.consume(token)
  │    ├─ busca por SHA-256(token)
  │    ├─ rechaza si no existe / expiró / ya fue usado
  │    └─ lo marca como usado (un solo uso)
  ├─ UserService.setPassword(userId, newPassword)  → bcryptjs (10 rondas)
  └─ RefreshTokenService.revokeAll(userId)         → invalida sesiones activas
```

---

## 3. Variables de entorno

Todas se documentan en `apps/auth/.env.example` y se declaran en `turbo.json` (`globalEnv`).

| Variable                         | Default                                 | Uso                                                                |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `PASSWORD_RECOVERY_EXPIRES_IN`   | `1h`                                    | Vida del token de recuperación.                                    |
| `PASSWORD_RECOVERY_MIN_INTERVAL` | `60s`                                   | Intervalo mínimo entre solicitudes del mismo usuario (anti-abuso). |
| `EMAIL_PROVIDER`                 | `log`                                   | `log` (no envía) o `resend` (envío real).                          |
| `EMAIL_FROM`                     | `Food Bosco <no-reply@foodbosco.local>` | Remitente de los correos.                                          |
| `RESEND_API_KEY`                 | _(vacío)_                               | API key de Resend. Obligatoria si `EMAIL_PROVIDER=resend`.         |
| `FRONTEND_URL`                   | `http://localhost:3000`                 | URL base del frontend que recibe el enlace de restablecimiento.    |
| `PASSWORD_RESET_PATH`            | `/reset-password`                       | Ruta del formulario de nueva contraseña.                           |

> **Importante:** `RESEND_API_KEY` es un secreto. No se versiona, no se expone al frontend y no se
> registra en logs. Si `EMAIL_PROVIDER=resend` y falta la API key, la aplicación falla al iniciar
> (fail fast) para evitar arrancar sin poder enviar correos.

### Configurar el proveedor de correo

1. Crear una cuenta en [Resend](https://resend.com) y verificar el dominio remitente (DNS: SPF/DKIM).
2. Generar una API key.
3. Configurar en `apps/auth/.env`:
   ```env
   EMAIL_PROVIDER=resend
   EMAIL_FROM=Food Bosco <no-reply@tudominio.com>
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   FRONTEND_URL=https://app.foodbosco.com
   PASSWORD_RESET_PATH=/reset-password
   ```
4. Verificar el dominio remitente en Resend (configuración externa pendiente, ver §7).

Sin proveedor configurado (`EMAIL_PROVIDER=log`, default) el sistema no envía correos reales:
solo registra el destinatario y el asunto (sin token ni enlace).

---

## 4. Reglas de seguridad, expiración e invalidación

- **Token independiente:** es un token opaco aleatorio (`crypto.randomBytes(32)`), no un JWT de
  acceso ni un refresh token.
- **Solo hash en base de datos:** se persiste `sha256(token)`; el token crudo solo viaja en el email.
- **Un solo uso:** al consumirse se marca `used = true`; un segundo intento devuelve
  `INVALID_OR_EXPIRED_TOKEN` (400).
- **Expiración:** `expiresAt = ahora + PASSWORD_RECOVERY_EXPIRES_IN`. Existe un índice TTL de MongoDB
  sobre `expiresAt` que elimina los tokens vencidos.
- **Invalidación de tokens previos:** al pedir uno nuevo se marcan como usados todos los tokens
  activos del usuario (solo el último es válido).
- **Intervalo mínimo anti-abuso:** dentro de `PASSWORD_RECOVERY_MIN_INTERVAL` no se genera ni envía
  un nuevo token (evita spam de correos).
- **Respuesta neutral:** la solicitud siempre responde `200 { ok: true }`, exista o no el correo
  (no permite enumerar usuarios).
- **Errores del proveedor:** se registran sin filtrar datos sensibles y no cambian la respuesta
  pública (sigue siendo neutral).
- **Sesiones:** el restablecimiento revoca todos los refresh tokens del usuario; los access tokens
  vigentes expiran por su corta vida.
- **Sin logs sensibles:** nunca se registran contraseñas, tokens completos ni credenciales del
  proveedor.
- **URL generada en el backend:** el enlace se construye con `FRONTEND_URL` + `PASSWORD_RESET_PATH`;
  no se aceptan URLs arbitrarias del cliente.
- **Sin cambios de privilegios:** el restablecimiento solo modifica `passwordHash`; no toca rol,
  estado, sucursal ni otros datos.

---

## 5. Índices de `passwordRecovery`

```text
{ userId: 1 }                     # búsqueda de tokens por usuario
{ tokenHash: 1 } (unique)         # lookup por hash, sin colisiones
{ userId: 1, used: 1 }            # invalidación de tokens activos
{ expiresAt: 1 } (TTL 0s)         # limpieza automática de tokens vencidos
```

---

## 6. Cómo probar localmente

1. Levantar los servicios:
   ```bash
   npm run dev
   ```
2. (Opcional) Ver el correo sin proveedor real: con `EMAIL_PROVIDER=log`, el Auth Service registra
   en consola `Email simulado para <correo> — asunto: ...`. Para obtener el enlace, revisar la
   colección `passwordRecovery` o configurar Resend.
3. Solicitar la recuperación (GraphQL, sin token):
   ```graphql
   mutation {
     requestPasswordRecovery(email: "cliente@foodbosco.local")
   }
   ```
4. Abrir el enlace recibido (`http://localhost:3000/reset-password?token=...`) o tomar el token
   crudo y ejecutar:
   ```graphql
   mutation {
     resetPassword(token: "<token>", newPassword: "NuevaClave123")
   }
   ```
5. Verificar login con la nueva contraseña y que el token ya no sirva (segundo intento → error).

### Tests

```bash
npm run test -w @repo/auth        # unitarios (incluye email y recuperación)
npm run test:e2e -w @repo/auth    # e2e con mongodb-memory-server
npm run test -w @repo/gateway
npm run test:e2e -w @repo/gateway
```

Los tests no realizan envíos reales: el proveedor de correo se reemplaza por un doble de prueba
(`overrideProvider(EMAIL_PROVIDER)`).

---

## 7. Configuración externa pendiente

- **Credenciales de Resend:** crear la API key y cargarla en `RESEND_API_KEY` (no versionada).
- **Verificación del dominio remitente:** completar los registros DNS (SPF/DKIM) en Resend para que
  los correos lleguen y no caigan en spam.
- **URL del frontend por entorno:** definir `FRONTEND_URL` correcto en cada ambiente (dev/staging/prod).
