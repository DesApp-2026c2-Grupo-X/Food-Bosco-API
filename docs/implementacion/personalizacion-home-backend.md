# Plan — Personalización de la home en backend

> **Estado:** PROPUESTA v2 (revisada contra el código el 2026-11-18)
> **Servicio principal:** `apps/commerce`
> **Capa de exposición:** `apps/gateway`
> **Complementa:** `planPersonalizacionHome.md` (frontend, vive en el repositorio de frontend)
> **Arquitectura:** Frontends → GraphQL Gateway → REST → microservicios
> **Alcance:** Commerce (principal), Gateway y documentación. Auth sólo en fase 2. Delivery sin cambios.

> **Estado de implementación (2026-11-18):** Etapas 1–4 implementadas.
> Decisiones aplicadas: D1 = home pública (spec T-05), D2 = OpenAPI documental + cliente manual,
> D4 = disponibilidad global, D7 = sólo sucursales abiertas.
> En la Tienda, `VITE_HOME_FEED=true` activa `homeFeed`; el cálculo local queda como fallback.
> Pendiente: métricas de operación y preferencias explícitas.

---

## 0. Cambios respecto de la v1

Esta versión corrige los hallazgos de la revisión contra el código:

| #   | Qué cambió                                                                                              | Motivo                                                                        |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | El feed devuelve `Product`, `Branch` y `Category` completos; `PromotionSummary` y `ReorderCard` nuevos. | Los tipos GraphQL existentes tienen campos non-null que el JSON v1 no cubría. |
| 2   | Los estados REST se escriben en minúscula (`delivered`).                                                | DB y REST usan minúsculas; GraphQL mapea a `DELIVERED`.                       |
| 3   | El módulo es `controller → orchestrator → servicios primarios` + `ranking.ts` puro.                     | Un servicio primario no puede leer repositorios de otros dominios.            |
| 4   | OpenAPI/codegen se trata como decisión explícita, no como algo ya existente.                            | No hay `packages/contracts` ni codegen en el repo.                            |
| 5   | La migración del frontend se marca como handoff a otro repositorio.                                     | `@repo/api`, `@repo/domain` y el plan de frontend no viven acá.               |
| 6   | Se explicita la contradicción home pública vs `customer`.                                               | La especificación funcional define la home como pública.                      |
| 7   | Se resuelve la duda de promociones con el contrato real.                                                | `categoryIds`, `productIds`, `branchIds`, `scope` y `priority` ya existen.    |
| 8   | La identidad sale sólo del JWT; `X-User-Id` es propagación.                                             | Commerce verifica el JWT e ignora `X-User-Id`.                                |

---

## 1. Resumen

La personalización no se resuelve en el navegador: se mueve a un módulo del **Commerce Service**, se expone
por REST y se publica con una query GraphQL `homeFeed` en el gateway. No se crea un microservicio nuevo
y el gateway no calcula reglas de negocio (RQ-GW-12).

El frontend actual sigue funcionando: el endpoint es aditivo y la home puede mantener su cálculo local
como fallback hasta que el backend esté estable.

---

## 2. Diagnóstico del backend actual

### 2.1 Datos disponibles

| Dato                                                                | Dueño               | Uso para personalización                        |
| ------------------------------------------------------------------- | ------------------- | ----------------------------------------------- |
| `orders` con `clientId`, `branchId`, `status`, `createdAt`, `items` | Commerce            | Historial, frecuencia, recencia, reordenamiento |
| `products`, `categories`                                            | Commerce            | Candidatos, categorías, disponibilidad          |
| `branches`, `branchProductAvailability`                             | Commerce            | Cercanía y disponibilidad por sucursal          |
| `promotions`                                                        | Commerce            | Beneficios vigentes y segmentación              |
| `addresses`                                                         | Auth                | Coordenadas validadas y pertenencia             |
| `users`                                                             | Auth                | Identidad y rol                                 |
| JWT                                                                 | Gateway → servicios | Identidad verificada por cada servicio          |

> **Corrección de la v1:** la identidad no la garantiza `X-User-Id`. El `RolesGuard` de Commerce valida el
> Bearer JWT y arma el contexto desde el token (`apps/commerce/src/config/security/roles.guard.ts:61-63`);
> `X-User-Id`, `X-Roles` y `X-Branch-Id` son sólo propagación del gateway.

### 2.2 Brechas reales

- La home pide catálogo, sucursales, pedidos y promociones por separado; el cliente arma el ranking.
- `GET /v1/orders` acepta hasta 2000 pedidos por request y el frontend no tiene una política de ventana
  de historial (`order-query.dto.ts:20-25`).
- No existe un endpoint de feed personalizado ni una query GraphQL `homeFeed`.
- No hay preferencias explícitas en `users`.
- No hay una política única de diversidad, recencia o descubrimiento.
- La dirección seleccionada vive en el cliente; no hay `defaultAddressId` persistido.
- La home está documentada como **pública** (`requerimientos-frontend.md`, T-05), pero el producto de
  personalización asume sesión. Es una decisión pendiente (ver §16).

### 2.3 Contrato real de promociones (duda resuelta)

`Promotion` ya tiene `type`, `scope`, `categoryIds`, `productIds`, `branchIds`, `priority`, `stackable`,
`maxUsesTotal`, `maxUsesPerCustomer` y `usedCount` (`promotion.model.ts:41-84`). También existen:

- `GET /v1/catalog/promotions/public`: vigentes (`active` + fechas), ordenadas por `priority` y
  `createdAt` (`promotion.repository.ts:196-205`). Devuelve el subconjunto `PublicBannerPromotion`.
- `PromotionService.getCandidates()`: promociones con tipo de descuento, filtrables por sucursal
  (`promotion.repository.ts:165-194`).

Por lo tanto, la personalización de promociones por afinidad **es posible**; no hay que inventar campos.
Sólo hay que decidir qué subconjunto se expone en la home (ver §5 y §7.6).

### 2.4 Lo que no se va a hacer

- No crear un microservicio de recomendaciones.
- No calcular scores en el gateway.
- No persistir el ranking.
- No reutilizar `POST /v1/orders/{id}/repeat` ni duplicar lógica de stock/carrito.
- No introducir Redis ni caché distribuida en fase 1.

---

## 3. Arquitectura

```text
Store / apps
  │ GraphQL: homeFeed(input)
  ▼
GraphQL Gateway
  │ 1. GET /v1/addresses/{addressId}            → Auth (valida pertenencia; devuelve lat/lng)
  │ 2. GET /v1/personalization/home-feed?lat=&lng=&... → Commerce
  ▼
Commerce Service
  └── módulo personalization
        controller → PersonalizationOrchestrator
                       ├── OrderService        (historial del cliente)
                       ├── ProductService      (candidatos)
                       ├── CategoryService     (categorías activas)
                       ├── BranchService       (favorita y cercana)
                       ├── PromotionService    (vigentes)
                       └── ranking.ts          (funciones puras, sin Mongo)
```

El gateway ya tiene el precedente exacto en `myCart` (`commerce.resolver.ts:300-320`): valida `addressId`
contra Auth y pasa coordenadas a Commerce. Se reutiliza ese patrón.

### Opciones descartadas

| Opción                                 | Por qué no                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ranking en el Gateway                  | Viola RQ-GW-12.                                                                          |
| Nuevo microservicio de recomendaciones | Duplica datos de Commerce para un volumen que no lo justifica.                           |
| ML desde el inicio                     | No hay señales de clic/impresión ni volumen; primero medir el ranking determinístico.    |
| Commerce llamando a Auth               | Los servicios primarios no se llaman entre sí; el gateway orquesta.                      |
| Ranking precalculado                   | Agrega invalidación y complejidad sin beneficio con los límites de historial propuestos. |

---

## 4. Alcance funcional

El endpoint devuelve en una sola operación:

1. **Contexto:** `hasHistory`, categoría principal, sucursal favorita y sucursal más cercana.
2. **Categorías** ordenadas por afinidad.
3. **Para vos:** productos recomendados con motivo y puntaje.
4. **Descubrí algo nuevo:** productos de categorías no exploradas.
5. **Volvé a pedir:** pedidos entregados recientes y distintos.
6. **Promociones:** vigentes y ordenadas por afinidad cuando hay señal.

Reglas:

- Las secciones vacías se devuelven como arreglos vacíos, no como error.
- `hasHistory=false` cuando no hay pedidos entregados en la ventana.
- El backend no devuelve datos de otro usuario ni acepta `userId` por parámetro.
- El feed no crea carritos ni reserva stock.

---

## 5. Contrato GraphQL

```graphql
input HomeFeedInput {
  addressId: ID
  lat: Float
  lng: Float
  forYouLimit: Int
  discoveryLimit: Int
  reorderLimit: Int
}

type Query {
  homeFeed(input: HomeFeedInput): HomeFeed!
}

enum RecommendationReason {
  REPEAT
  FAVORITE_CATEGORY
  DISCOVERY
  POPULAR
}

type ProductRecommendation {
  product: Product!
  reason: RecommendationReason!
  hint: String
  score: Float!
}

type NearbyBranch {
  branch: Branch!
  distanceMeters: Float!
}

type PromotionSummary {
  id: ID!
  name: String!
  description: String
  startDate: String!
  endDate: String!
  type: PromotionType
  discountValue: Float
  maxDiscount: Float
  buyQuantity: Int
  payQuantity: Int
  scope: PromotionScope
  categoryIds: [ID!]!
  productIds: [ID!]!
  branchIds: [ID!]!
  minSubtotal: Float!
  minQuantity: Int!
  daysOfWeek: [Int!]!
  startTime: String
  endTime: String
}

type ReorderItem {
  productId: ID!
  name: String!
  quantity: Int!
}

type ReorderCard {
  id: ID!
  number: String!
  status: OrderStatus!
  createdAt: String!
  total: Float!
  branchId: ID!
  branch: Branch
  items: [ReorderItem!]!
}

type HomeFeed {
  generatedAt: String!
  hasHistory: Boolean!
  topCategory: Category
  favoriteBranch: Branch
  nearestBranch: NearbyBranch
  categories: [Category!]!
  forYou: [ProductRecommendation!]!
  discovery: [ProductRecommendation!]!
  reorder: [ReorderCard!]!
  promotions: [PromotionSummary!]!
}
```

### Reglas del contrato

1. **Objetos hidratados.** `Product`, `Branch` y `Category` se devuelven completos desde Commerce para
   satisfacer sus campos non-null (`commerce.types.ts:105-135`, `:249-273`). El gateway sólo mapea.
2. **`PromotionSummary`, no `Promotion`.** El tipo `Promotion` es administrativo y expone `usedCount`,
   `maxUsesTotal`, `maxUsesPerCustomer` y `code`. La home usa un resumen público sin esos campos.
3. **`ReorderCard`, no `Order`.** El tipo `Order` exige `clientId`, `deliveryAddress`, `statusHistory`,
   `availableTransitions`, etc. (`commerce.types.ts:402-462`). La tarjeta de la home no los necesita.
4. **Límites.** El resolver normaliza los límites antes de llamar a Commerce y Commerce los vuelve a
   limitar: `forYou` 1–12, `discovery` 1–8, `reorder` 1–5. Valores ausentes usan 8/4/3.
5. **Defaults en code-first.** En Nest, los valores por defecto se declaran en `@Args`, no en el SDL.
6. **Identidad.** `userId` sale del JWT; nunca del input.
7. **`addressId`.** Sólo lo usa el gateway contra Auth. No se envía a Commerce: a Commerce llegan
   `lat`/`lng` ya validados (o coordenadas explícitas del cliente para contenido público).
8. **`POPULAR`.** Se reserva en el enum para la evolución. En v1 no se emite (ver §7.7).

### Acceso

- **v1 propuesta:** `@Roles(customer)` en `homeFeed`, consistente con `myOrders`.
- **Si el producto mantiene la home pública:** quitar `@Roles` y aceptar request anónima. Commerce debe
  responder `hasHistory=false`, `forYou=[]`, `discovery=[]` y `reorder=[]`. Es la decisión D1 (§16) y
  debe quedar alineada con la especificación funcional.

---

## 6. Contrato REST — Commerce Service

```http
GET /v1/personalization/home-feed?lat=-34.6&lng=-58.4&forYouLimit=8&discoveryLimit=4&reorderLimit=3
Authorization: Bearer <JWT>
X-User-Id: <uuid>
X-Roles: customer
```

- **Acceso:** `customer` en v1 (ver D1).
- **Identidad:** `auth.userId` desde el JWT verificado por Commerce.
- **Parámetros:**
  - `lat`, `lng`: opcionales; si faltan, no se calcula `nearestBranch`.
  - `forYouLimit`, `discoveryLimit`, `reorderLimit`: enteros acotados por DTO.
  - `addressId` **no** se recibe: el gateway ya lo resolvió contra Auth.
- **Errores:** envelope existente (`code`, `message`, `path`), 400 para parámetros inválidos, 401 sin
  token, 403 sin rol, 503 si falla una dependencia.

### Respuesta

```json
{
  "generatedAt": "2026-11-18T03:00:00.000Z",
  "hasHistory": true,
  "topCategory": { "id": "cat_burgers", "name": "Hamburguesas", "active": true },
  "favoriteBranch": {
    "id": "branch_centro",
    "name": "Centro",
    "addressText": "Av. Siempre Viva 123",
    "latitude": -34.6,
    "longitude": -58.4,
    "phone": null,
    "active": true,
    "hours": []
  },
  "nearestBranch": {
    "branch": {
      "id": "branch_centro",
      "name": "Centro",
      "addressText": "Av. Siempre Viva 123",
      "latitude": -34.6,
      "longitude": -58.4,
      "phone": null,
      "active": true,
      "hours": []
    },
    "distanceMeters": 820
  },
  "categories": [{ "id": "cat_burgers", "name": "Hamburguesas", "active": true }],
  "forYou": [
    {
      "product": {
        "id": "prod_1",
        "categoryId": "cat_burgers",
        "name": "Burger doble",
        "description": "Doble carne",
        "price": 8500,
        "image": null,
        "available": true,
        "configGroups": [],
        "recipe": []
      },
      "reason": "REPEAT",
      "hint": "Ya lo pediste",
      "score": 5.25
    }
  ],
  "discovery": [
    {
      "product": {
        "id": "prod_9",
        "categoryId": "cat_salads",
        "name": "Ensalada",
        "description": "Fresca",
        "price": 6200,
        "image": null,
        "available": true,
        "configGroups": [],
        "recipe": []
      },
      "reason": "DISCOVERY",
      "hint": "Nuevo para vos",
      "score": 1.5
    }
  ],
  "reorder": [
    {
      "id": "order_10",
      "number": "102",
      "status": "delivered",
      "createdAt": "2026-11-10T10:00:00.000Z",
      "total": 21000,
      "branchId": "branch_centro",
      "branch": { "...": "objeto Branch completo o null" },
      "items": [{ "productId": "prod_1", "name": "Burger doble", "quantity": 2 }]
    }
  ],
  "promotions": [
    {
      "id": "promo_1",
      "name": "2x1 en burgers",
      "description": null,
      "startDate": "2026-11-01T00:00:00.000Z",
      "endDate": "2026-11-30T23:59:59.000Z",
      "type": "BUY_X_GET_Y",
      "discountValue": null,
      "maxDiscount": null,
      "buyQuantity": 2,
      "payQuantity": 1,
      "scope": "CATEGORY",
      "categoryIds": ["cat_burgers"],
      "productIds": [],
      "branchIds": [],
      "minSubtotal": 0,
      "minQuantity": 0,
      "daysOfWeek": [],
      "startTime": null,
      "endTime": null
    }
  ]
}
```

> Los objetos `Product`, `Branch` y la promoción se muestran abreviados; el contrato exige todos los
> campos de `PublicProduct`, `PublicBranch` y `PublicPromotion` (menos los excluidos en
> `PromotionSummary`). `status` va en minúscula porque es el valor de DB/REST.

### Contrato OpenAPI (decisión D2)

Hoy **no** existen `packages/contracts`, `openapi.yaml` ni codegen (ver `docs/auditoria/13-ARQUITECTURA-CALIDAD.md`
A3 y `docs/API_DEMO_GUIDE.md:2056`). El gateway escribe paths a mano en `rest.client.ts`. La especificación
exige clientes generados (RQ-GW-03), pero esa brecha está declarada fuera de alcance.

Opciones:

- **Recomendada para esta entrega:** crear `packages/contracts/openapi/commerce/v1/personalization.openapi.yaml`
  como contrato documental y mantener el cliente `RestClient` manual para este endpoint, registrando la
  desviación en la documentación.
- Alternativa completa: crear el paquete de contratos + codegen para todos los servicios. Es una iniciativa
  aparte y no debería bloquear la personalización.

---

## 7. Algoritmo de ranking

### 7.1 Perfil de gustos

Se calcula on-demand con los últimos pedidos **entregados** del usuario:

- Ventana: últimos **100 pedidos** o **365 días**, lo que ocurra primero.
- Sólo `delivered`; se excluyen `cancelled` y pedidos activos.
- Fecha de referencia: la última transición a `delivered` en `statusHistory`; si no existe, `createdAt`.
- Peso por recencia: vida media de **45 días**: `w = 0.5 ^ (díasDesdeEntrega / 45)`.
- `productScore[productId] += cantidad × w`.
- `categoryScore[categoryId] += cantidad × w` usando la categoría actual del producto en catálogo.
- `branchScore[branchId] += w`.
- Si un producto ya no existe en el catálogo, sigue contando para `productScore` y para "ya lo pediste",
  pero no aporta a `categoryScore`.
- `hasHistory` = existe al menos un pedido entregado en la ventana.

### 7.2 Para vos

Candidatos:

- `product.available = true`.
- En v1 **no** se filtra por sucursal (decisión D4). Si se habilita, usar
  `availableInBranch`, recordando que hoy vale `true` cuando no hay fila
  (`branch.orchestrator.ts:68-79`).

Puntaje:

```text
p = productScore normalizado (0..1)
c = categoryScore normalizado (0..1)

score = 3·p + 1.5·c
      + (producto ya pedido ? 2 : 0)
      + (categoría en top 3 ? 1 : 0)
```

- Normalización: dividir cada suma por el máximo de su serie; si el máximo es 0, el componente vale 0.
- Desempate determinístico: `score desc`, luego `name asc`, luego `id asc`
  (el catálogo ya se ordena por nombre: `product.repository.ts:90,127`).

Reglas:

- Diversidad: máximo **2 productos por categoría** en la primera pasada.
- Si faltan slots, se completa con el excedente ordenado por score.
- Se excluyen no disponibles y productos ya mostrados en otra sección.
- `reason`:
  - `REPEAT` si el producto fue comprado;
  - `FAVORITE_CATEGORY` si su categoría tiene historial;
  - `DISCOVERY` si su categoría no tiene historial;
  - `POPULAR` no se usa en v1.

### 7.3 Descubrí algo nuevo

- Candidatos de categorías **sin historial**, `available=true`.
- Excluir productos ya comprados y los ya devueltos en `forYou`.
- Máximo 2 por categoría.
- Si faltan slots, completar con productos no comprados de categorías conocidas.
- Si `hasHistory=false`, devolver `[]`.

### 7.4 Volvé a pedir

- Pedidos `delivered`, ordenados por fecha de entrega descendente.
- Deduplicar por firma `branchId + productIds ordenados`; conservar el más reciente.
- Máximo 3.
- Devolver sólo `id`, `number`, `status`, `createdAt`, `total`, `branchId`, `branch` hidratada e ítems
  (`productId`, `name`, `quantity`).
- Si la sucursal fue eliminada, `branch=null` pero la tarjeta se conserva.
- No se valida stock: `POST /v1/orders/{id}/repeat` ya lo hace al crear el carrito.

### 7.5 Categorías

- Se devuelven todas las activas.
- Orden: `categoryScore desc`, luego `name asc`.
- Las categorías sin historial conservan el orden del catálogo (nombre).
- No se eliminan categorías.

### 7.6 Promociones

- Filtro: `active=true`, `startDate <= now <= endDate`.
- Se incluyen promociones informativas (`type=null`), que la home puede mostrar como banner.
- Orden por afinidad:
  - +2 si `productIds` incluye un producto comprado;
  - +1.5 si `categoryIds` incluye una categoría con historial;
  - +1 si `branchIds` incluye la sucursal favorita;
  - desempate por `priority desc` y `createdAt desc`.
- Se devuelve `PromotionSummary` (sin `usedCount`, `maxUses*` ni `code`).
- En v1 **no** se filtra por sucursal: una promoción con `branchIds` se muestra igual. El filtrado por
  sucursal de entrega queda para una fase posterior (D4).
- Tope de salida: 20 promociones.

### 7.7 Usuario nuevo o sin historial

- `hasHistory=false`.
- `forYou=[]`, `discovery=[]`, `reorder=[]`. El frontend mantiene el catálogo como contenido de la home.
- `POPULAR` queda reservado para una fase con agregación global de ventas.
- Categorías activas en orden de catálogo.
- Promociones vigentes sin personalización.
- `nearestBranch` se calcula si hay coordenadas.

### 7.8 Constantes

| Constante               | Valor               | Uso                                  |
| ----------------------- | ------------------- | ------------------------------------ |
| `HISTORY_WINDOW_DAYS`   | 365                 | Ventana máxima de historial          |
| `HISTORY_MAX_ORDERS`    | 100                 | Tope de pedidos leídos               |
| `HALF_LIFE_DAYS`        | 45                  | Peso por recencia                    |
| `MAX_PER_CATEGORY`      | 2                   | Diversidad en `forYou` y `discovery` |
| `FOR_YOU_DEFAULT/MAX`   | 8/12                | Límite de la sección                 |
| `DISCOVERY_DEFAULT/MAX` | 4/8                 | Límite de la sección                 |
| `REORDER_DEFAULT/MAX`   | 3/5                 | Límite de la sección                 |
| `PROMOTION_LIMIT`       | 20                  | Tope de promociones                  |
| `MAX_DISTANCE_KM`       | parámetro existente | Zona de sucursales                   |

---

## 8. Cambios por capa

### 8.1 Commerce Service

Nuevo dominio de orquestación:

```text
apps/commerce/src/personalization/
├── personalization.controller.ts
├── personalization.orchestrator.ts
├── personalization.module.ts
├── personalization.model.ts        # tipos de salida del feed
├── ranking.ts                      # funciones puras, sin Nest ni Mongo
├── ranking.spec.ts
└── dto/
    └── home-feed-query.dto.ts
```

Responsabilidades:

- **Controller:** valida DTO, obtiene `auth.userId`, llama al orchestrator. No toca repositorios.
- **Orchestrator:** pide datos a cada servicio primario, llama a `ranking.ts` y compone el feed.
- **`ranking.ts`:** recibe pedidos, productos, categorías, sucursales, promociones y `now`; devuelve el
  perfil y las secciones. Sin inyección de dependencias.
- **Servicios primarios:** se agregan métodos de lectura acotados, sin romper los existentes:
  - `OrderService.listDeliveredByClient(clientId, { from, limit })`.
  - `ProductService.listAvailable()`.
  - `CategoryService.listActive()`.
  - `BranchService.listAvailableWithDistance(lat, lng)` (reutiliza `haversineDistanceKm`).
  - `BranchService.findById(branchId)` (ya existe).
  - `PromotionService.getActiveForHome(now)` (usa `findPublicActive`, serializa completo).
- **Repositorios:** sólo se agregan consultas dentro de su propio dominio.
- No se modifica `POST /v1/orders/{id}/repeat`, ni carrito, ni stock, ni la máquina de estados.

### 8.2 GraphQL Gateway

Archivos nuevos dentro de `apps/gateway/src/graphql/commerce/`:

```text
home-feed.inputs.ts
home-feed.types.ts
home-feed.mapper.ts
home-feed.resolver.ts
```

- `@UseGuards(AuthGuard)`; `@Roles(customer)` en v1 (D1).
- Pasos del resolver:
  1. normalizar límites;
  2. si viene `addressId`, `GET /v1/addresses/{addressId}` contra Auth (404 → error GraphQL);
  3. llamar a Commerce con `lat`/`lng`;
  4. mapear a los tipos GraphQL.
- No calcula scores ni decide secciones.
- Propagación de errores con `RestClient` (ya traduce `code`, `message`, `path`).
- **Timeout:** `RestClient` hoy no configura timeout (`fetch` sin `AbortSignal`). Agregar una opción
  `timeoutMs` con un valor acotado (por ejemplo 3000 ms) y aplicarla al feed; el resto de las llamadas
  puede mantener el comportamiento actual.
- **Rate limit:** ya existe el throttler global por token/IP (`throttle.module.ts`). Si se quiere un
  límite más bajo para `homeFeed`, usar `@Throttle` en el resolver.
- **DataLoader:** no usarlo para el feed. El DataLoader actual deduplica pero hace un GET por id
  (`docs/auditoria/13-ARQUITECTURA-CALIDAD.md` A1); el feed debe venir hidratado desde Commerce.

### 8.3 Auth Service

**Fase 1:** sin cambios. Se sigue usando `GET /v1/addresses/{addressId}`.

**Fase 2 (opcional):**

- `users.preferences`: `favoriteCategoryIds`, `dietaryRestrictions`, `defaultAddressId`, `updatedAt`.
- `GET /v1/me/preferences` y `PATCH /v1/me/preferences`.
- El gateway pasa las preferencias como contexto al feed.

### 8.4 Delivery Service

Sin cambios.

### 8.5 Frontend (handoff a otro repositorio)

Este monorepo no contiene `apps/store` ni `packages/api`/`packages/domain`. La migración es una entrega
externa:

- hook `useHomeFeed` en `@repo/api`;
- mapeo a `@repo/domain`;
- feature flag (por ejemplo `VITE_HOME_FEED=true`);
- fallback al cálculo local mientras el backend no esté estable;
- eliminación de la duplicación de pesos cuando `homeFeed` sea la fuente principal.

### 8.6 Documentación

- Agregar el endpoint a `docs/especificaciones/requerimientos-backend-rest.md` (tablas de endpoints y
  schema GraphQL).
- Registrar este plan en `docs/README.md`.
- Si se adopta OpenAPI, crear el documento y dejar constancia de que el cliente sigue siendo manual.

---

## 9. Modelo de datos e índices

### Fase 1: sin colecciones nuevas

Se leen `orders`, `products`, `categories`, `branches`, `branchProductAvailability` y `promotions`.

### Índices actuales relevantes

| Colección                   | Índices actuales                                                    |
| --------------------------- | ------------------------------------------------------------------- |
| `orders`                    | `number` único, `clientId`, `branchId`, `demoBatchId`               |
| `products`                  | `categoryId`, `name` único                                          |
| `categories`                | `name` único                                                        |
| `branches`                  | `name` único                                                        |
| `promotions`                | `{ active, startDate, endDate }`, `branchIds`, `code` parcial único |
| `branchProductAvailability` | único `{ branchId, productId }`                                     |

### Índices recomendados

```text
orders:     { clientId: 1, status: 1, createdAt: -1 }
orders:     { clientId: 1, createdAt: -1 }
products:   { available: 1, categoryId: 1 }
categories: { active: 1 }
branches:   { active: 1 }
```

> La base es compartida por los tres servicios (auditoría A4). Los índices nuevos afectan a todos:
> coordinarlos con reporting, que ya lee estas colecciones.

### Fase 2: preferencias

```text
users.preferences: {
  favoriteCategoryIds: [ObjectId],
  dietaryRestrictions: [string],
  defaultAddressId: ObjectId | null,
  updatedAt: Date
}
```

### Fase 3 (opcional): eventos de recomendación

```text
recommendationEvents: {
  _id, userId, section, productId?, orderId?,
  event (impression|click|dismiss|add_to_cart),
  createdAt, expiresAt
}
```

Requiere consentimiento, política de privacidad y TTL. No es necesario para v1.

---

## 10. Seguridad y privacidad

- **Identidad:** `userId` desde el JWT verificado en Commerce. Nunca desde query, body o `X-User-Id`.
- **Dirección:** el gateway valida `addressId` en Auth; una dirección ajena devuelve 404. Commerce sólo
  recibe coordenadas.
- **Aislamiento:** el feed sólo lee pedidos del `userId` autenticado.
- **RBAC:** `customer` en v1; si la home es pública, request anónima sin datos personales.
- **Logs:** no registrar direcciones, coordenadas exactas ni tokens. Usar `requestId` y, si hace falta,
  coordenadas redondeadas.
- **Rate limiting:** el throttler global ya cubre el gateway; opcionalmente bajar el límite para el feed.
- **Datos locales:** las vistas recientes del navegador no se envían al backend en fase 1.
- **Preferencias (fase 2):** sólo el propio usuario puede leerlas o modificarlas.

---

## 11. Rendimiento y caché

- Costo O(pedidos + productos + promociones), acotado por la ventana y los topes.
- No traer el catálogo completo si crece: v1 puede usar `listAvailable()` con tope; si el catálogo supera
  el tope, filtrar por las categorías con historial y completar con el resto.
- Objetivo: **p95 < 300 ms** para el endpoint en entorno de prueba. Medición propuesta: script o e2e con
  al menos 100 pedidos y 300 productos de fixture, reportando p50/p95.
- Sin caché distribuida en fase 1 (no hay Redis).
- Fase 2: caché en memoria por instancia, TTL 60 s, clave `userId + geohash + límites`; invalidar al
  crear un pedido o cambiar una promoción.
- El DataLoader del gateway no cachea el feed.

---

## 12. Etapas de implementación

### Etapa 0 — Definición y contratos

- Resolver D1 (home pública o `customer`) y actualizar la especificación funcional.
- Aprobar los tipos GraphQL (`PromotionSummary`, `ReorderCard`) y el contrato REST.
- Decidir D2 (OpenAPI/codegen vs cliente manual).
- Actualizar `requerimientos-backend-rest.md` y `docs/README.md`.
- Acordar la estructura `personalization/` con orchestrator y `ranking.ts` puro.

**Salida:** contratos aprobados y documentados. Sin código de negocio.

### Etapa 1 — Ranking puro

- Implementar perfil, `forYou`, `discovery`, `reorder`, categorías y promociones en `ranking.ts`.
- Tests unitarios con fixtures, sin Mongo.
- Fijar las constantes de §7.8.

**Dependencia:** Etapa 0.

### Etapa 2 — Servicios, repositorios y endpoint REST

- Agregar métodos de lectura a Order/Product/Category/Branch/Promotion.
- Crear `GET /v1/personalization/home-feed` con DTO y errores estándar.
- Índices de §9.
- Tests e2e con `test/mongo.ts`.
- Medición de latencia.

**Dependencia:** Etapa 1.

### Etapa 3 — Gateway GraphQL

- Tipos, input, mapper y resolver `homeFeed`.
- Validación de `addressId` en Auth y límites.
- RBAC, timeout y errores.
- Tests de resolver con downstream mockeado (`test/downstream.ts`).

**Dependencia:** Etapas 0 y 2.

### Etapa 4 — Handoff al frontend (otro repositorio)

- Entregar contrato y ejemplos.
- Hook `useHomeFeed`, flag y fallback.
- Comparación en staging y regresión de la home.

**Dependencia:** Etapa 3.

### Etapa 5 — Operación y métricas

- Logs con `requestId`, latencia, errores y uso del fallback.
- Revisión de límites y performance.

### Etapa 6 — Evolución (opcional)

- Preferencias explícitas y `defaultAddressId`.
- Eventos de impresión/clic con consentimiento.
- A/B testing y ajuste de pesos.
- ML sólo con volumen y métricas suficientes.

---

## 13. Pruebas y criterios de aceptación

### Unitarias (`ranking.spec.ts`)

- Perfil con pedidos entregados, cancelados y activos.
- Recencia: un pedido viejo pesa menos que uno reciente.
- Diversidad: máximo 2 por categoría cuando hay alternativas.
- Productos no disponibles excluidos.
- Descubrimiento no repite comprados ni recomendados.
- Reordenamiento deduplica por firma y conserva el más reciente.
- Promociones: vigencia, afinidad y desempate por prioridad.
- Usuario nuevo: `hasHistory=false`, secciones vacías.
- Determinismo: mismos datos y `now` → mismo resultado.
- Normalización: el score queda acotado y no depende de la magnitud del historial.

### Integración (`apps/commerce/test/personalization.e2e-spec.ts`)

- Sólo devuelve pedidos del `X-User-Id`/JWT autenticado.
- Sin coordenadas, `nearestBranch=null` y el feed funciona.
- Producto pausado o no disponible no aparece.
- `addressId` ajeno se rechaza en el gateway (404).
- Sucursal eliminada: `reorder[].branch=null` sin romper la respuesta.
- Errores de Mongo/validación en el envelope estándar.
- Todos los campos non-null de los tipos se serializan.

### Gateway (`apps/gateway/test/graphql-home-feed.e2e-spec.ts`)

- `homeFeed` exige JWT en v1.
- El resolver no calcula scores ni secciones.
- Límites fuera de rango se recortan.
- `addressId` inválido devuelve error controlado y no rompe otras queries.
- Timeout de Commerce devuelve `SERVICE_UNAVAILABLE`.
- No hay N+1: el gateway no pide producto/sucursal por cada recomendación.

### Frontend (repositorio externo)

- Con `homeFeed` disponible, la home muestra las mismas secciones.
- Con `homeFeed` caído, el fallback local funciona.
- Sin regresiones en hero, categorías, promociones y CTA.
- No se mezclan recomendaciones entre usuarios.

### Criterios de aceptación

- Usuario nuevo: catálogo/promociones, sin secciones personales.
- Usuario con historial: `forYou`, `discovery` y `reorder` coherentes.
- Ningún producto no disponible.
- Feed determinístico para los mismos datos y fecha.
- p95 medido dentro del objetivo acordado.
- Ningún dato de otro usuario.
- Contrato aditivo: las queries actuales siguen funcionando.

---

## 14. Riesgos y mitigaciones

| Riesgo                                       | Impacto                      | Mitigación                                                              |
| -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| Tipos GraphQL parciales                      | Errores non-null             | Hidratar completos; `PromotionSummary`/`ReorderCard`; test de contrato. |
| Ranking en el gateway                        | Rompe la arquitectura        | Mantenerlo en Commerce; revisión de código.                             |
| Servicio primario leyendo otros repositorios | Deuda arquitectónica         | Orchestrator + `ranking.ts` puro.                                       |
| Duplicar lógica frontend/backend             | Resultados distintos         | Flag, comparación en staging y eliminación del cálculo local.           |
| Historial grande                             | Latencia                     | Ventana 100/365 + índices + topes.                                      |
| Promociones con segmentación inconsistente   | Orden incorrecto             | Usar `scope` para interpretar IDs; vigencia + prioridad como fallback.  |
| Productos/sucursales borrados                | Referencias huérfanas        | Snapshot del pedido; `branch=null`; ignorar producto inexistente.       |
| Dirección no persistida                      | Falta multi-dispositivo      | Fase 2: `defaultAddressId`.                                             |
| Home pública vs `customer` sin decidir       | Contrato ambiguo             | D1 bloqueante en Etapa 0.                                               |
| `availableInBranch` default `true`           | Filtro por sucursal engañoso | No filtrar por sucursal en v1.                                          |
| Datos sensibles en logs                      | Privacidad                   | Sin coordenadas exactas ni PII; `requestId`.                            |
| Caché cruzada                                | Privacidad                   | Clave por usuario; no cachear sin aislamiento.                          |
| Sin timeout en `RestClient`                  | Home colgada                 | Agregar `timeoutMs` al feed.                                            |

---

## 15. Migración y compatibilidad

1. El endpoint y la query son aditivos; no se elimina nada del contrato actual.
2. El frontend mantiene el flujo actual como fallback.
3. Se compara `homeFeed` con el cálculo local en staging.
4. Se habilita por flag o porcentaje.
5. Con errores y latencia estables, pasa a ser la fuente principal.
6. La lógica local queda sólo como resiliencia.
7. Cambios incompatibles de REST van a `/v2`; en GraphQL se marca `@deprecated`.

---

## 16. Decisiones

### Resueltas por el código

1. **Promociones:** existen `categoryIds`, `productIds`, `branchIds`, `priority` y `scope`. Se puede
   rankear por afinidad.
2. **Identidad:** JWT verificado por Commerce; `X-User-Id` no es fuente de identidad.
3. **Rate limit:** ya existe y es global.
4. **Estados:** REST/DB en minúscula; GraphQL en mayúscula.

### Pendientes (bloqueantes para la Etapa 0)

| ID  | Decisión                             | Opciones                                                  | Recomendación                                                               |
| --- | ------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | Home pública o sólo `customer`       | Pública con secciones vacías / sólo `customer`            | Mantener pública según la spec T-05 y devolver secciones vacías sin sesión. |
| D2  | OpenAPI/codegen                      | Paquete completo / documento + cliente manual             | Documento OpenAPI + cliente manual; codegen como iniciativa aparte.         |
| D3  | Dirección preferida                  | Persistir `defaultAddressId` en Auth / seguir en cliente  | Fase 2; v1 sigue recibiendo la selección del cliente.                       |
| D4  | Disponibilidad por sucursal          | Global / sucursal más cercana                             | Global en v1; evaluar por sucursal cuando el catálogo lo requiera.          |
| D5  | Preferencias explícitas              | En Auth (`users.preferences`) / en Commerce               | Auth, porque son datos de perfil.                                           |
| D6  | Eventos de interacción               | Recolectar con consentimiento / sólo historial de pedidos | Sólo historial en v1.                                                       |
| D7  | `nearestBranch` con sucursal cerrada | Cualquier sucursal / sólo abiertas                        | Sólo abiertas, reutilizando `findAvailable`; `null` si no hay ninguna.      |

---

## 17. Resultado esperado

Un endpoint `homeFeed` que:

- devuelve en una sola llamada el contenido personalizado de la home;
- mantiene la lógica de negocio en Commerce y el gateway fino;
- funciona para usuarios nuevos y con historial;
- respeta disponibilidad, pertenencia de la dirección y privacidad;
- no expone campos administrativos de promociones;
- permite migrar el frontend sin romper la experiencia actual;
- deja preparado el camino para preferencias, métricas y ML.

---

## 18. Relación con el plan de frontend

- `planPersonalizacionHome.md` sigue siendo válido como primera versión y fallback.
- Este plan es la evolución server-side.
- Cuando `homeFeed` esté estable, el backend manda y el cliente conserva sólo un fallback mínimo.
