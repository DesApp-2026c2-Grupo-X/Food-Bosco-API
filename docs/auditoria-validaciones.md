# Auditoría de validaciones, errores y mensajes — Food-Bosco

Fecha: 2026-10-20  
Rama: `feature/validation-errors-audit` (API y Frontend)

## 1. Alcance y skills usadas

Se auditaron `Food-Bosco-API` (gateway, auth, commerce, delivery) y `Food-Bosco-Frontend`
(store, admin, branch, rider y paquetes compartidos `api`, `auth`, `domain`).

Skills consultadas y aplicadas:

- `orchestrator-domain-architecture`: respeto del flujo Controller → Orchestrator → Servicios
  primarios → Repositorios al tocar stock, pedidos y carrito.
- `high-quality-tests`: tests parametrizados, casos límite, concurrencia y verificación por
  código y mensaje.
- `save-prompts`: registro de esta interacción en `docs/prompts/`.

No se consultaron skills de React/GraphQL/Mongoose específicas porque el entorno solo expone
las tres skills anteriores; el trabajo se apoyó en las convenciones reales del repositorio.

## 2. Matriz de auditoría priorizada

| Funcionalidad | Validación encontrada | Problema | Solución implementada | Capa | Prioridad | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Descuento de stock al pasar a `preparing` | Lectura + escritura con recorte a 0 | Dos pedidos concurrentes podían vender de más; el stock se recortaba silenciosamente | Descuento atómico con `findOneAndUpdate` condicionado por cantidad; compensación si falla un ingrediente; error `INSUFFICIENT_STOCK` con `details` | Commerce / Mongo | P0 | Corregido |
| Transición de estados de pedido | `findById` + `save` | Dos requests concurrentes podían aplicar la misma transición y descontar stock dos veces | `findOneAndUpdate` condicionado por estado; idempotencia y `CONFLICT` si cambió el estado | Commerce | P0 | Corregido |
| Confirmación de pedido | Se creaba el pedido y luego se confirmaba el carrito | Doble clic o dos requests podían crear dos pedidos con el mismo carrito | Reclamo atómico del carrito (`active → confirmed`) antes de crear; liberación si falla la creación; `CART_CONFIRMED` | Commerce / Mongo | P0 | Corregido |
| Descuento de stock fallido | El pedido quedaba en `preparing` | Estado inconsistente si el stock cambió entre confirmar y preparar | Se revierte la transición y se responde el error de stock | Commerce | P1 | Corregido |
| Errores internos del Gateway | Se devolvía el mensaje original | Fugas de `ECONNREFUSED`, rutas internas y mensajes técnicos al usuario | Mensaje genérico seguro + log técnico con `requestId`; se conservan códigos y `details` de dominio | Gateway | P0 | Corregido |
| Errores 401/403 del Gateway | Mensajes `Unauthorized` / `Forbidden` en inglés | Mensajes poco claros y no accionables | Mensajes en español; se preservan mensajes específicos de dominio | Gateway | P1 | Corregido |
| Fallas de red Gateway → microservicio | `fetch` rechazaba con el error técnico | El usuario veía detalles internos y el error no era distinguible | `SERVICE_UNAVAILABLE` con mensaje accionable y correlación | Gateway | P1 | Corregido |
| Errores de microservicio en Delivery | `throw new Error("... HTTP 500")` | Se perdía el código/status de dominio y se convertía en 500 genérico | Propagación de código, mensaje, status y `details`; red → 503 | Delivery | P1 | Corregido |
| Validación de DTOs REST | `ValidationPipe` con `whitelist` | Sin `details` por campo; campos desconocidos se descartaban en silencio | Pipe con `forbidNonWhitelisted`, `details.fields` y mensajes en español | REST | P1 | Corregido |
| Formato de teléfono y email | Solo longitud / email | Teléfonos arbitrarios y correos con mayúsculas/espacios | Regex de teléfono consistente con frontend; normalización de email a minúsculas | Auth | P1 | Corregido |
| Credenciales inválidas | `Credenciales inválidas` | Mensaje poco claro; tiempo de respuesta distinto si el correo no existía | Mensaje “El correo electrónico o la contraseña son incorrectos” y comparación dummy de bcrypt | Auth | P1 | Corregido |
| Cuenta deshabilitada | `Usuario inactivo` | No explicaba cómo continuar | Mensaje accionable con contacto al administrador | Auth | P2 | Corregido |
| Cantidades de carrito | `Min(1)` | Sin máximo ni unicidad de opciones | Máximo 99 y `ArrayUnique`; límite de opciones | Commerce | P1 | Corregido |
| Ajuste de stock | `IsNumber` y recorte a 0 | Permitía 0, decimales y dejar stock negativo | Entero distinto de 0; negativo mayor al stock → `INSUFFICIENT_STOCK` con `details` | Commerce | P1 | Corregido |
| Mensajes en frontend | Mensajes genéricos por pantalla | Se ocultaban los mensajes específicos del backend | `getApiErrorMessage` compartido; aplicado a checkout, carrito/producto, auth, sucursal, rider y admin | Frontend | P1 | Corregido |
| Detalles de error en frontend | No se leían `extensions.details` | No se mostraba stock disponible ni errores por campo | El helper prioriza `details.fields` y stock; evita textos técnicos | Frontend | P1 | Corregido |
| Autorización por sucursal | `branchId` del token, no del cliente | Correcto en pedidos/stock | Sin cambios; se mantiene la regla existente | Commerce/Delivery | — | Verificado |
| Ítems duplicados en carrito | Se apilan ítems | Es una decisión funcional existente | Sin cambios | Commerce | — | Verificado |
| Propiedad de `addressId` al crear pedido | No se valida contra Auth | Un cliente podría referenciar una dirección ajena | No se modificó: requiere contrato entre Commerce y Auth | Commerce/Auth | P2 | Pendiente |
| Números de pedido | `count() + 1` | Posible colisión bajo alta concurrencia | No se modificó: requiere contador atómico/colección de secuencias | Commerce | P2 | Pendiente |
| Concurrencia en viajes/ofertas | Lectura + `save` | Doble aceptación o doble entrega bajo concurrencia | No se modificó en esta iteración | Delivery | P2 | Pendiente |

## 3. Cambios por archivo

### API

- `apps/*/src/config/exceptions/domain.exception.ts`: `details` opcional.
- `apps/*/src/config/exceptions/http-exception.filter.ts`: envelope con `code`, `message`,
  `details`, `path` y `requestId` (si viene en el header).
- `apps/*/src/config/validation/validation.pipe.ts`: pipe común estricto con errores por campo.
- `apps/*/src/main.ts`: uso del pipe común.
- `apps/gateway/src/observability/graphql-error-formatter.ts`: saneamiento, mensajes claros,
  `details`, `requestId` solo para logs.
- `apps/gateway/src/rest/rest.client.ts`: propagación de `details`/`requestId`, red →
  `SERVICE_UNAVAILABLE`, cuerpo inválido no se convierte en éxito.
- `apps/commerce/src/stock/*`: descuento/ajuste atómico, `restore`, `details` de stock.
- `apps/commerce/src/order/*`: transición atómica, reversión, reclamo/liberación de carrito.
- `apps/commerce/src/cart/*`: `claim`, `release`, `confirm` atómico.
- `apps/commerce/src/cart/dto/*` y `stock/dto/*`: límites, unicidad y enteros.
- `apps/auth/src/user/*` y DTOs: normalización de email, mensajes claros, teléfono y timing.
- `apps/delivery/src/config/http/*`: propagación de errores de Auth/Commerce.

### Frontend

- `packages/api/src/utils/errorMessage.ts`: traducción de errores Apollo/GraphQL a mensajes
  accionables, con `details` de campos y stock.
- `packages/api/src/index.ts`: export del helper.
- `packages/auth/src/hooks/useAuthForm.ts`: muestra el mensaje específico del backend.
- `apps/store/src/pages/CheckoutPage`, `apps/store/src/pages/ProductDetailPage`,
  `apps/branch/src/components/BranchStatusButton`, `apps/rider/src/pages/ProfilePage`,
  `apps/admin/src/pages/BranchEditPage`: usan el helper.
- Tests nuevos/actualizados en `packages/api`, auth, store, admin, branch y rider.

## 4. Pruebas ejecutadas

API:

- Unitarias: commerce 1398, auth 689, gateway 634, delivery 536. Todas pasan.
- E2E seleccionadas:
  - Commerce: `stock`, `order-flow`, `cart`, `validation` → pasan.
  - Auth: `auth-flows`, `authorization`, `users`, `app`, `seed-and-profile-edges` → 134 pasan.
  - Gateway: suite e2e completa → 563 pasan (tras actualizar mensajes esperados).
- `npm run typecheck` y `npm run lint`: sin errores.

Frontend:

- `packages/api` (errorMessage), `packages/auth`, store (checkout, producto, carrito, purchase
  flow), admin (BranchEditPage), branch (BranchStatusButton), rider (ProfilePage):
  25 archivos / 136 tests + suites puntuales de checkout y producto → pasan.
- `npm run check-types` y `npm run lint`: sin errores.
- La suite completa de Vitest no se completó dentro del tiempo de ejecución de la sesión;
  se ejecutaron de forma dirigida todas las áreas modificadas.

## 5. Limitaciones y siguientes pasos

1. Validar que `addressId` pertenezca al cliente al crear el pedido (requiere llamada
   Commerce → Auth o mover la referencia a un snapshot confiable).
2. Reemplazar la numeración `count() + 1` por una secuencia atómica.
3. Hacer atómicas las transiciones de viajes/ofertas en Delivery para evitar dobles
   aceptaciones/entregas.
4. Evaluar transacciones de MongoDB para pedido + ítems + stock si la infraestructura usa
   replica set.
5. Completar la suite E2E de frontend en CI con un timeout mayor.
