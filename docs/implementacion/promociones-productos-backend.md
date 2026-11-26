# Plan — Backend: previews de promociones y catálogo público

> **Estado:** IMPLEMENTADO · **Fecha:** 2026-11-19
> **Repo:** `DESAPP`
> **Servicios:** `apps/commerce` (principal) y `apps/gateway`
> **Auth / Delivery:** sin cambios
> **Plan de frontend:** `Food-Bosco-Frontend/docs/planes/plan-promociones-productos.md`

---

## 0. Decisiones cerradas

1. La sucursal se resuelve desde la dirección igual que el carrito: `branchService.findAvailable(lat, lng)[0]`.
2. Porcentaje con `maxDiscount`: badge + “Tope $X”. **No** se devuelve precio estimado.
3. Porcentaje sin `maxDiscount`: badge + precio anterior + precio estimado por unidad.
4. `FIXED_AMOUNT`: badge `Hasta $X OFF` en tarjeta y página. **No** se devuelve precio estimado.
5. `BUY_X_GET_Y`: badge `2x1` / `3x2`. **No** se devuelve precio estimado.
6. Si `minSubtotal` o `minQuantity` no se cumplen con una unidad, la promo se muestra igual con
   `conditionsMet=false` y sin precio estimado. El frontend muestra “Sujeto a compra mínima” o
   “Mínimo N unidades”.
7. Las promociones `ORDER` y las informativas (`type=null`) no se muestran en tarjetas de producto;
   sí en la página de promociones.
8. Los cupones se muestran en la página de promociones con su `code`.
9. La página de promociones hidrata productos y categorías en Commerce.
10. La home feed también calcula previews.
11. No se persisten previews ni se modifica el motor de precios del carrito.

---

## 1. Objetivo

1. Que los endpoints de productos que consume la Tienda devuelvan, por producto, la mejor promo
   vigente para mostrar en la tarjeta y la lista completa para el detalle.
2. Exponer un catálogo público de promociones vigentes con categorías y productos hidratados para
   la página `/promotions`.
3. Mantener el precio del carrito como única fuente de verdad.
4. Evitar N+1 y respetar la arquitectura `controller → orchestrator → servicios primarios → repositorio`.

---

## 2. Diagnóstico verificado

| Punto                               | Código actual                                                                                                                                | Consecuencia                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Catálogo con dirección              | `useCatalog` manda `filter {lat,lng}`; el gateway llama a `/v1/branches/available/products` (`commerce.resolver.ts:125-134`).                | Extender sólo `/v1/catalog/products` no alcanza.  |
| Detalle de producto                 | `product(id)` no recibe coordenadas (`commerce.resolver.ts:149-158`).                                                                        | No se puede calcular la sucursal para el detalle. |
| Catálogo de productos sin dirección | `ProductController.list` usa `limit ?? 20` y no calcula previews.                                                                            | Sólo promociones globales si no hay coordenadas.  |
| Promociones públicas                | `findPublicActive` filtra `active` + fechas, pero no día, horario ni sucursal (`promotion.repository.ts:196-205`).                           | La página podría mostrar promos no aplicables.    |
| Contrato público                    | `PublicBannerPromotion` no incluye `active`, `code`, `minSubtotal`, `minQuantity`, `daysOfWeek`, ni horarios (`promotion.model.ts:162-194`). | Faltan datos para cupones y condiciones.          |
| Regla de arquitectura               | `CLAUDE.md`: un servicio primario no llama a otro servicio primario.                                                                         | El cálculo debe vivir en orchestrators.           |
| Motor de precios                    | `evaluatePromotions` calcula sobre el carrito completo y aplica `maxDiscount` al total (`promotion.engine.ts:114-157`).                      | El preview es informativo, no autoritativo.       |

---

## 3. Arquitectura

```text
Controller
  └── Orchestrator
        ├── ProductService        (productos)
        ├── PromotionService      (promociones)
        ├── CategoryService       (categorías)
        ├── BranchService         (sucursal)
        └── promotion.preview.ts  (funciones puras, sin Mongo)
```

Reglas:

- `ProductService`, `PromotionService`, `CategoryService` y `BranchService` **no se llaman entre sí**.
- La coordinación vive en `ProductOrchestrator`, `BranchOrchestrator`, `PromotionOrchestrator` y
  `PersonalizationOrchestrator`.
- El gateway **no calcula** reglas de negocio; sólo mapea y transporta.
- Todo cálculo de preview es batch: una consulta de promociones por request, no una por producto.

### Módulos Nest

- `ProductModule` agrega `forwardRef(() => PromotionModule)` y `forwardRef(() => BranchModule)`.
- `BranchModule` agrega `forwardRef(() => PromotionModule)`.
- `PromotionModule` ya usa `forwardRef` con Product/Branch/Category.
- `PersonalizationModule` ya importa Product, Promotion, Branch y Category.
- `CategoryService` agrega `findByIds(ids)` para hidratar categorías en batch.

---

## 4. Contrato GraphQL

### 4.1 Enum y preview por producto

```graphql
enum PromotionBadgeKind {
  PERCENTAGE
  FIXED_AMOUNT
  BUY_X_GET_Y
  COUPON
  INFORMATIONAL
}

type ProductPromotionPreview {
  promotionId: ID!
  name: String!
  kind: PromotionBadgeKind!
  badge: String!
  originalPrice: Float!
  estimatedUnitPrice: Float
  discountValue: Float
  maxDiscount: Float
  minSubtotal: Float!
  minQuantity: Int!
  conditionsMet: Boolean!
  promotionCount: Int!
  endsAt: String!
}

type Product {
  # campos actuales...
  promotion: ProductPromotionPreview
  promotions: [ProductPromotionPreview!]!
}
```

Reglas:

- `promotion` es el mejor preview para la tarjeta.
- `promotions` es la lista completa para el detalle. Debe devolver `[]`, nunca `null`.
- `estimatedUnitPrice` es `null` para `FIXED_AMOUNT`, `BUY_X_GET_Y`, porcentaje con tope y cuando
  `conditionsMet=false`.
- `promotionCount` es la cantidad de promociones elegibles para ese producto.
- `endsAt` es la `endDate` ISO.

### 4.2 Catálogo público de promociones

```graphql
type PromotionCatalogItem {
  id: ID!
  name: String!
  description: String
  type: PromotionType
  scope: PromotionScope
  kind: PromotionBadgeKind!
  badge: String!
  discountValue: Float
  maxDiscount: Float
  buyQuantity: Int
  payQuantity: Int
  startDate: String!
  endDate: String!
  daysOfWeek: [Int!]!
  startTime: String
  endTime: String
  minSubtotal: Float!
  minQuantity: Int!
  branchIds: [ID!]!
  code: String
  categoryIds: [ID!]!
  productIds: [ID!]!
  categories: [Category!]!
  products: [Product!]!
}

type Query {
  promotionCatalog(lat: Float, lng: Float): [PromotionCatalogItem!]!
}
```

Reglas de hidratación:

- `scope=PRODUCT`: `products` contiene los productos de `productIds` con su mejor preview;
  `categories` queda vacío.
- `scope=CATEGORY`: `categories` contiene las categorías de `categoryIds`; `products` queda vacío.
  No se expanden todos los productos de la categoría.
- `scope=ORDER` o informativa: `categories` y `products` vacíos.
- No se exponen `usedCount`, `maxUsesTotal` ni `maxUsesPerCustomer`.
- `code` sí se expone: es el código que el cliente debe ingresar en el carrito.

### 4.3 Query de producto con coordenadas

```graphql
type Query {
  product(id: ID!, lat: Float, lng: Float): Product
}
```

- Si vienen `lat` y `lng`, Commerce resuelve la sucursal más cercana disponible.
- Si no vienen, sólo se evalúan promociones globales.
- Si viene sólo uno de los dos, responder `400`.

---

## 5. Contrato REST

### 5.1 Endpoints

```http
GET /v1/catalog/products?lat=-34.6&lng=-58.4&limit=100
GET /v1/catalog/products/{id}?lat=-34.6&lng=-58.4
GET /v1/branches/available/products?lat=-34.6&lng=-58.4
GET /v1/catalog/promotions/public/catalog?lat=-34.6&lng=-58.4
```

- `/v1/catalog/products` y `/v1/catalog/products/{id}` aceptan `lat`/`lng` opcionales.
- `/v1/branches/available/products` ya resuelve la sucursal; sólo hay que agregar previews a cada producto.
- `/v1/catalog/promotions/public/catalog` es el único endpoint nuevo.

### 5.2 Respuesta de producto

```json
{
  "id": "p1",
  "categoryId": "c1",
  "name": "Hamburguesa clásica",
  "price": 1000,
  "available": true,
  "promotion": {
    "promotionId": "pr1",
    "name": "20% en hamburguesas",
    "kind": "PERCENTAGE",
    "badge": "-20%",
    "originalPrice": 1000,
    "estimatedUnitPrice": 800,
    "discountValue": 20,
    "maxDiscount": null,
    "minSubtotal": 0,
    "minQuantity": 0,
    "conditionsMet": true,
    "promotionCount": 2,
    "endsAt": "2026-11-30T23:59:59.000Z"
  },
  "promotions": []
}
```

### 5.3 Respuesta del catálogo público

```json
[
  {
    "id": "pr1",
    "name": "20% en hamburguesas",
    "description": "Válido todos los días",
    "type": "percentage",
    "scope": "product",
    "kind": "PERCENTAGE",
    "badge": "-20%",
    "discountValue": 20,
    "maxDiscount": null,
    "buyQuantity": null,
    "payQuantity": null,
    "startDate": "2026-11-01T00:00:00.000Z",
    "endDate": "2026-11-30T23:59:59.000Z",
    "daysOfWeek": [],
    "startTime": null,
    "endTime": null,
    "minSubtotal": 0,
    "minQuantity": 0,
    "branchIds": [],
    "code": null,
    "categories": [],
    "products": []
  }
]
```

> El `products` de ejemplo queda vacío sólo para abreviar; en `scope=product` debe venir hidratado.

---

## 6. Algoritmo de preview

Archivo nuevo: `apps/commerce/src/promotion/promotion.preview.ts`.

### 6.1 Funciones puras

```ts
export interface ProductPreviewResult {
  promotion: ProductPromotionPreview | null
  promotions: ProductPromotionPreview[]
  promotionCount: number
}

export const resolveProductPromotionPreviews = (
  products: PublicProduct[],
  promotions: PublicPromotion[],
  branchId: string | null,
  now: Date,
): Map<string, ProductPreviewResult> => {
  /* ... */
}

export const resolvePromotionCatalog = (
  promotions: PublicPromotion[],
  products: PublicProduct[],
  categories: PublicCategory[],
  previewsByProduct: Map<string, ProductPreviewResult>,
): PublicPromotionCatalogItem[] => {
  /* ... */
}
```

Reglas:

- Reutilizar `isScheduleMatch` e `isBranchMatch` de `promotion.engine.ts`. No duplicar horarios ni zona Argentina.
- Reutilizar `PROMOTION_TYPE` y `PROMOTION_SCOPE` de `config/constants`.
- No importar repositorios ni modelos Mongoose.

### 6.2 Elegibilidad por producto

Un preview existe si:

1. `promotion.active === true`.
2. `promotion.type !== null`.
3. `startDate <= now <= endDate`.
4. `daysOfWeek` vacío o incluye el día actual (zona Argentina).
5. `startTime/endTime` vacíos o incluyen la hora actual.
6. `branchIds` vacío o incluye `branchId`.
7. El producto está `available`.
8. El scope aplica al producto:
   - `PRODUCT`: `productIds.includes(product.id)`.
   - `CATEGORY`: `categoryIds.includes(product.categoryId)`.
   - `ORDER`: **no** genera preview de producto.

### 6.3 Cálculo por tipo

```text
PERCENTAGE:
  raw = Math.round(price * discountValue / 100)
  capped = maxDiscount != null ? Math.min(raw, maxDiscount) : raw
  estimatedUnitPrice =
    maxDiscount == null && conditionsMet
      ? Math.max(0, price - capped)
      : null
  badge = `-${formatNumber(discountValue)}%`

FIXED_AMOUNT:
  estimatedUnitPrice = null
  badge = `Hasta ${formatPrice(discountValue)} OFF`

BUY_X_GET_Y:
  estimatedUnitPrice = null
  badge = `${buyQuantity}x${payQuantity}`
```

- `formatPrice` y `formatNumber` usan `Intl.NumberFormat('es-AR')`.
- Redondeo a pesos enteros, igual que `calculatePromotionAmount` del motor.
- `FIXED_AMOUNT` nunca muestra precio final: depende del subtotal elegible.
- `BUY_X_GET_Y` nunca muestra precio final: depende de la cantidad.

### 6.4 `conditionsMet`

```ts
const conditionsMet = promotion.minSubtotal <= product.price && promotion.minQuantity <= 1
```

- Si no se cumple, se devuelve igual el preview con `conditionsMet=false` y
  `estimatedUnitPrice=null`.
- El frontend muestra “Sujeto a compra mínima” o “Mínimo N unidades”.

### 6.5 Selección del mejor preview

Para ordenar, calcular un score interno (no se expone):

```text
PERCENTAGE:    min(round(price * discountValue / 100), maxDiscount ?? Infinity)
FIXED_AMOUNT:  min(discountValue, price)
BUY_X_GET_Y:   price * (buyQuantity - payQuantity) / buyQuantity
```

Selección:

1. Preferir los previews con `conditionsMet=true`.
2. Dentro de ese grupo, mayor score.
3. Desempate: mayor `priority`, luego `endDate` más próxima, luego `id` ascendente.
4. Si ninguno cumple condiciones, elegir el mejor del grupo completo con el mismo criterio.
5. `promotionCount` = cantidad total de previews elegibles (incluye los que no cumplen mínimos).

> El score es sólo para elegir qué promo mostrar. No es un precio ni se persiste.

### 6.6 Catálogo público

```ts
getPublicCatalog(branchId, now):
  promotions = promotionService.getPublicCatalogCandidates(branchId, now)
  productIds = promociones PRODUCT -> productIds
  categoryIds = promociones CATEGORY -> categoryIds
  products = productService.findByIds(unique(productIds))
  categories = categoryService.findByIds(unique(categoryIds))
  previews = resolveProductPromotionPreviews(products, promotions, branchId, now)
  return promotions.map(p => resolvePromotionCatalogItem(p, products, categories, previews))
```

Reglas:

- Una sola consulta de promociones, una de productos y una de categorías.
- `scope=PRODUCT`: adjuntar a cada producto su mejor preview.
- `scope=CATEGORY`: devolver categorías; no expandir productos.
- Orden: `priority` descendente, luego `startDate` descendente.
- Incluir promociones informativas (`type=null`).
- No incluir promociones vencidas, inactivas, fuera de día/horario o de otra sucursal.
- Si no hay coordenadas, `branchId=null`: sólo globales.
- `kind`/`badge` del catálogo:
  - `code != null` → `kind=COUPON`, `badge="Cupón"` (el `type` sigue informando el descuento).
  - `type=null` → `kind=INFORMATIONAL`, `badge="Beneficio"`.
  - `PERCENTAGE` → `kind=PERCENTAGE`, `badge="-20%"` (y `maxDiscount` si existe).
  - `FIXED_AMOUNT` → `kind=FIXED_AMOUNT`, `badge="Hasta $1.000 OFF"`.
  - `BUY_X_GET_Y` → `kind=BUY_X_GET_Y`, `badge="2x1"`.

---

## 7. Cambios en Commerce

### 7.1 Nuevos archivos

| Archivo                                                          | Responsabilidad                         |
| ---------------------------------------------------------------- | --------------------------------------- |
| `apps/commerce/src/promotion/promotion.preview.ts`               | Funciones puras de preview y selección. |
| `apps/commerce/src/promotion/promotion.preview.spec.ts`          | Tests parametrizados.                   |
| `apps/commerce/src/promotion/dto/promotion-catalog-query.dto.ts` | `lat`/`lng` opcionales con validación.  |
| `apps/commerce/src/product/dto/product-detail-query.dto.ts`      | `lat`/`lng` opcionales para el detalle. |

### 7.2 `promotion.model.ts`

Agregar:

```ts
export type PromotionBadgeKind =
  'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'COUPON' | 'INFORMATIONAL'

export interface ProductPromotionPreview {
  promotionId: string
  name: string
  kind: PromotionBadgeKind
  badge: string
  originalPrice: number
  estimatedUnitPrice: number | null
  discountValue: number | null
  maxDiscount: number | null
  minSubtotal: number
  minQuantity: number
  conditionsMet: boolean
  promotionCount: number
  endsAt: string
}

export interface PublicPromotionCatalogItem {
  id: string
  name: string
  description: string | null
  type: PromotionType | null
  scope: PromotionScope | null
  kind: PromotionBadgeKind
  badge: string
  discountValue: number | null
  maxDiscount: number | null
  buyQuantity: number | null
  payQuantity: number | null
  startDate: string
  endDate: string
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  minSubtotal: number
  minQuantity: number
  branchIds: string[]
  code: string | null
  categoryIds: string[]
  productIds: string[]
  categories: PublicCategory[]
  products: PublicProduct[]
}
```

- `PublicProduct` agrega `promotion: ProductPromotionPreview | null` y
  `promotions: ProductPromotionPreview[]`.
- El serializer de producto no calcula previews; lo hace el orchestrator. Los campos son opcionales
  en el tipo para no romper usos existentes.

### 7.3 `promotion.repository.ts`

Agregar un método nuevo, sin tocar `findActiveCandidates` (lo usa el carrito):

```ts
findActivePublicCandidates(params: { branchId: string | null; now: Date }): Promise<PromotionDocument[]>
```

- Filtro: `active: true`, `startDate <= now`, `endDate >= now`.
- Si `branchId` viene, `$or: [{ branchIds: { $size: 0 } }, { branchIds: branchId }]`.
- Incluye `type: null`.
- Orden: `{ priority: -1, createdAt: -1 }`.

### 7.4 `promotion.service.ts`

Agregar:

```ts
async getPublicCatalogCandidates(
  branchId: string | null,
  now: Date = new Date(),
): Promise<PublicPromotion[]>
```

- Serializa con `serializePromotion`.
- Filtra con `isScheduleMatch` (día/horario).
- No filtra por tipo.
- Mantiene el orden por prioridad.

### 7.5 `promotion.orchestrator.ts`

Agregar:

```ts
async getPublicCatalog(lat?: number, lng?: number): Promise<PublicPromotionCatalogItem[]>
```

- Resolver coordenadas: ambos o ninguno; si falta uno, `400`.
- Si hay coordenadas: `branchService.findAvailable(lat, lng)[0]?.id ?? null`.
- `promotionService.getPublicCatalogCandidates(branchId, now)`.
- Hidratar productos y categorías en batch.
- Delegar el armado a `resolvePromotionCatalog`.
- No llamar a repositorios de otros dominios.

> `PromotionOrchestrator` ya inyecta `ProductService`, `CategoryService` y `BranchService`.

### 7.6 `promotion.controller.ts`

Agregar antes de `@Get(':promotionId')`:

```ts
@Get('public/catalog')
getPublicCatalog(@Query() query: PromotionCatalogQueryDto) {
  return this.orchestrator.getPublicCatalog(query.lat, query.lng)
}
```

- Ruta: `GET /v1/catalog/promotions/public/catalog`.
- Sin `@Roles`: es pública, igual que `public`.
- `PromotionCatalogQueryDto`: `lat`/`lng` opcionales, rangos válidos.
- El constructor hoy tiene `orchestrator?`; para este endpoint usarlo como requerido o actualizar los tests
  que instancian el controller sin orchestrator.

### 7.7 `product.orchestrator.ts`

Agregar:

```ts
async listWithPreviews(query: ProductListQuery, coords?: { lat?: number; lng?: number }): Promise<ProductListResponse>
async findByIdWithPreviews(id: string, coords?: { lat?: number; lng?: number }): Promise<PublicProduct | null>
```

- Resolver sucursal con `BranchService` si hay coordenadas; si no, `null`.
- `promotionService.getCandidates({ branchId, now })` (una sola consulta).
- `resolveProductPromotionPreviews` y adjuntar a cada producto.
- Si el producto no existe, devolver `null`.
- `listWithPreviews` respeta `meta` del listado original.

### 7.8 `product.controller.ts`

- `list`: llamar a `orchestrator.listWithPreviews` en lugar de `productService.list`.
- `get`: llamar a `orchestrator.findByIdWithPreviews`.
- `ProductQueryDto`: agregar `lat`/`lng` opcionales y validar rangos.
- `ProductDetailQueryDto`: nuevo, `lat`/`lng` opcionales.
- Mantener la lógica de `isAdmin` y `available`.
- Si el orchestrator devuelve `null`, mantener el `404` actual.

### 7.9 `branch.orchestrator.ts`

- Inyectar `PromotionService`.
- En `buildProductList(branchId)`:
  - `promotionService.getCandidates({ branchId, now })`.
  - `resolveProductPromotionPreviews(products, promotions, branchId, now)`.
  - Adjuntar `promotion`/`promotions` a cada producto junto con `availableInBranch`.
- No cambiar la ruta ni la forma de resolver la sucursal.

### 7.10 `category.service.ts`

Agregar:

```ts
async findByIds(ids: string[]): Promise<PublicCategory[]>
```

- Delegar en `CategoryRepository.findByIds`.
- No llamar a otros servicios.

### 7.11 `personalization.orchestrator.ts`

- Usar `nearest?.branch.id ?? null` como `branchId`.
- Después de calcular `forYou` y `discovery`, adjuntar previews a cada producto:
  - `resolveProductPromotionPreviews(products, promotions, branchId, now)`.
  - Reemplazar `entry.product` por el producto con `promotion`/`promotions`.
- `promotions` ya se obtiene con `getActiveForHome`.
- No agregar consultas nuevas: reutilizar la lista de promociones y productos ya cargada.
- `forYou` y `discovery` son los únicos productos del feed; no tocar `reorder`.

### 7.12 Módulos

- `product.module.ts`: `forwardRef(() => PromotionModule)` y `forwardRef(() => BranchModule)`.
- `branch.module.ts`: `forwardRef(() => PromotionModule)`.
- Verificar que no haya ciclos de providers: los servicios no se llaman entre sí; sólo los
  orchestrators coordinan.

---

## 8. Cambios en Gateway

### 8.1 Enum

Nuevo `apps/gateway/src/graphql/common/promotion-badge-kind.enum.ts`:

```ts
export enum PromotionBadgeKind {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  COUPON = 'COUPON',
  INFORMATIONAL = 'INFORMATIONAL',
}

registerEnumType(PromotionBadgeKind, { name: 'PromotionBadgeKind' })
```

Incluir `promotionBadgeKindFromRest`.

### 8.2 `commerce.types.ts`

Agregar:

- `ProductPromotionPreview` (`@ObjectType`).
- Campos `promotion` y `promotions` en `Product`.
- `PromotionCatalogItem` (`@ObjectType`).
- `mapProductPromotionPreview`.
- `mapPromotionCatalogItem`.
- `mapProduct`:
  - `promotion: raw.promotion ? mapProductPromotionPreview(raw.promotion) : null`.
  - `promotions: asRecordList(raw.promotions).map(mapProductPromotionPreview)`.
  - `promotions` debe quedar `[]` si el REST no lo manda.

### 8.3 `commerce.resolver.ts`

- `products`: sin cambios de ruta; `mapProduct` ya mapea previews. Con `lat/lng` sigue usando
  `/v1/branches/available/products`.
- `product`: agregar `@Args('lat', { type: () => Float, nullable: true })` y `lng`; pasar query
  `{ lat, lng }` sólo si ambos vienen.
- `promotionCatalog`:
  - `@Query(() => [PromotionCatalogItem])`.
  - `@Args('lat', { nullable: true })`, `@Args('lng', { nullable: true })`.
  - `GET /v1/catalog/promotions/public/catalog` con query.
  - `raw.map(mapPromotionCatalogItem)`.

### 8.4 `home-feed.mapper.ts`

- Sin cambios estructurales: `mapProduct` ya mapea los previews que vienen en `Product`.
- Verificar que `forYou` y `discovery` usen `mapProduct`.

### 8.5 Tests de gateway

- `commerce.types.spec.ts`: mapping de previews, `promotions` default `[]`, enum inválido.
- `commerce.resolver.spec.ts`:
  - `product` con `lat/lng` → query correcta.
  - `promotionCatalog` → path y query.
  - `products` con `lat/lng` → branch endpoint y `availableInBranch`.
- `home-feed` si tiene spec: producto con previews.

---

## 9. OpenAPI y documentación

1. Crear `packages/contracts/openapi/commerce/v1/catalog-promotions.openapi.yaml` con:
   - `GET /v1/catalog/products`
   - `GET /v1/catalog/products/{id}`
   - `GET /v1/branches/available/products`
   - `GET /v1/catalog/promotions/public/catalog`
   - Schemas `Product`, `ProductPromotionPreview`, `PromotionCatalogItem`, `PromotionBadgeKind`.
2. Actualizar `packages/contracts/openapi/commerce/v1/personalization.openapi.yaml`:
   - Agregar `promotion` y `promotions` opcionales al schema `Product`.
3. Actualizar `docs/especificaciones/requerimientos-backend-rest.md`:
   - Endpoints nuevos y parámetros `lat/lng`.
   - Campos GraphQL nuevos.
4. Actualizar `docs/implementacion/promociones.md`:
   - Sección “Preview informativo y catálogo público”.
   - Aclarar que el carrito sigue siendo autoritativo.
5. Registrar el plan en `docs/README.md` cuando esté implementado.

---

## 10. Tests

### 10.1 Preview puro (`promotion.preview.spec.ts`)

Usar tablas `it.each`:

| Caso                          | Esperado                                              |
| ----------------------------- | ----------------------------------------------------- |
| 20% sin tope                  | `estimatedUnitPrice = 800`, `badge = -20%`            |
| 20% con tope $100             | `estimatedUnitPrice = null`, `maxDiscount=100`        |
| `FIXED_AMOUNT` $1.000         | `badge = Hasta $1.000 OFF`, `estimatedUnitPrice=null` |
| `BUY_X_GET_Y` 2x1             | `badge = 2x1`, `estimatedUnitPrice=null`              |
| `minSubtotal` mayor al precio | `conditionsMet=false`, sin precio estimado            |
| `minQuantity` 2               | `conditionsMet=false`, sin precio estimado            |
| Promo vencida                 | No aparece                                            |
| Día incorrecto                | No aparece                                            |
| Fuera de horario              | No aparece                                            |
| Otra sucursal                 | No aparece                                            |
| Inactiva                      | No aparece                                            |
| Producto no disponible        | No aparece                                            |
| `ORDER`                       | No genera preview de producto                         |
| Dos promos                    | Elige la de mayor score y `promotionCount=2`          |
| Empate de score               | Prioridad, luego fin más próximo, luego id            |
| Redondeo                      | Pesos enteros, misma convención que el motor          |

### 10.2 Orchestrators

- `ProductOrchestrator.listWithPreviews`:
  - Una sola llamada a `getCandidates`.
  - Adjunta previews a todos.
  - Sin coordenadas: sólo globales.
  - Con coordenadas: resuelve la sucursal.
- `BranchOrchestrator.buildProductList`:
  - Mantiene `availableInBranch`.
  - Adjunta previews.
- `PromotionOrchestrator.getPublicCatalog`:
  - Hidrata productos y categorías.
  - No expande productos de categorías.
  - Incluye informativas.
  - No incluye vencidas/fuera de horario/otra sucursal.
  - No hace N+1 (verificar llamadas).
- `PersonalizationOrchestrator`:
  - `forYou` y `discovery` llevan previews.
  - `reorder` no cambia.

### 10.3 Controllers

- `ProductController.list` llama al orchestrator.
- `ProductController.get` pasa coordenadas.
- `PromotionController.getPublicCatalog` usa el DTO y el orchestrator.
- `lat` sin `lng` → `400`.
- `lng` sin `lat` → `400`.

---

## 11. Criterios de aceptación

- [x] Un producto con 20% sin tope devuelve `estimatedUnitPrice` y badge `-20%`.
- [x] Un producto con 20% con tope devuelve badge `-20%`, `maxDiscount` y **no** `estimatedUnitPrice`.
- [x] Un producto con `FIXED_AMOUNT` devuelve badge `Hasta $X OFF` y **no** `estimatedUnitPrice`.
- [x] Un producto con `2x1` devuelve badge `2x1` y **no** `estimatedUnitPrice`.
- [x] Una promo con `minSubtotal`/`minQuantity` no cumplido devuelve `conditionsMet=false`.
- [x] Promociones vencidas, inactivas, fuera de día/horario o de otra sucursal no aparecen.
- [x] El catálogo con dirección (`/v1/branches/available/products`) devuelve previews.
- [x] El detalle con `lat/lng` devuelve previews.
- [x] La home feed devuelve previews en `forYou` y `discovery`.
- [x] `/v1/catalog/promotions/public/catalog` devuelve cupones, condiciones, categorías y productos.
- [x] No hay N+1: una consulta de promociones por request y batch de productos/categorías.
- [x] El motor y el contrato del carrito no cambian.
- [x] `npm run test`, `npm run lint` y `npm run typecheck` pasan.

---

## 12. Riesgos y mitigaciones

| Riesgo                                | Mitigación                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ciclos de módulos Nest                | Usar `forwardRef` en Product/Branch/Promotion; no llamar servicios entre sí.             |
| `promotions` no nulo en GraphQL       | `mapProduct` siempre devuelve `[]` si el REST no manda el campo.                         |
| Precio estimado distinto al carrito   | Es informativo; no se muestra si hay tope o mínimos; el carrito recalcula.               |
| Formato de moneda                     | Usar `Intl.NumberFormat('es-AR')` en backend para badges; el frontend usa `formatPrice`. |
| Performance                           | Batch de promociones/productos/categorías; no persistir previews.                        |
| Promos de otra sucursal               | `isBranchMatch` + `branchService.findAvailable`.                                         |
| Cambios en admin                      | Los campos son aditivos; el admin los ignora.                                            |
| Deploy del frontend antes que backend | Backend primero; los fragmentos GraphQL fallan si el esquema no existe.                  |

---

## 13. Fuera de alcance

- Modificar `evaluatePromotions`, `selectPromotions` o el cálculo del carrito.
- Persistir previews.
- Mostrar cupones como descuento de producto.
- Exponer `usedCount` o `maxUses*` en el catálogo público.
- Expansión de todos los productos de una promoción `CATEGORY`.
- Notificaciones, analítica o A/B testing.
- Cambios en Auth o Delivery.

---

## 14. Orden de implementación

1. Crear `promotion.preview.ts` y sus tests puros.
2. Extender modelo/serializers y repositorio de promociones.
3. Extender `CategoryService.findByIds`.
4. Implementar `PromotionOrchestrator.getPublicCatalog` + controller + DTO.
5. Implementar `ProductOrchestrator` + controller + DTOs.
6. Extender `BranchOrchestrator`.
7. Extender `PersonalizationOrchestrator`.
8. Ajustar módulos Nest.
9. Gateway: enum, tipos, mappers, resolver, args.
10. OpenAPI y documentación.
11. Tests de gateway y suite completa.
12. Deploy del backend.
