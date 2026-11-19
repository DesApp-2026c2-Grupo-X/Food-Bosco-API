# Revisión del plan de personalización de la home contra el código

- Fecha: 2026-11-18T00:57:53-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> # Plan — Personalización de la home en backend
>
> > **Estado:** PROPUESTA · **Fecha:** 2026-11-18
> > **Complementa:** `planPersonalizacionHome.md` (implementación frontend)
> > **Arquitectura objetivo:** Frontends → GraphQL Gateway → REST → microservicios
> > **Alcance:** Auth Service, Commerce Service, GraphQL Gateway y migración del frontend.
>
> ## 1. Respuesta corta
>
> **No conviene reutilizar el plan de frontend tal cual.**
>
> El plan actual resuelve la personalización en el navegador con datos que ya llegan al cliente. Eso
> sirve como primera versión, pero no cubre:
>
> - consistencia entre web y apps;
> - una única fuente de verdad para el ranking;
> - preferencias explícitas;
> - aprendizaje de interacciones;
> - caché y rendimiento compartidos;
> - evolución del algoritmo sin publicar un frontend nuevo.
>
> El plan de backend debe mover la **decisión de qué recomendar** a un módulo del **Commerce Service**,
> exponer un feed agregado por REST y publicarlo a través del **GraphQL Gateway**. No se crea un
> microservicio nuevo ni se pone lógica de negocio en el gateway.
>
> ## 2. Diagnóstico del backend actual
>
> ### Lo que ya existe y alcanza
>
> | Dato                                                                | Dueño               | Uso para personalización                           |
> | ------------------------------------------------------------------- | ------------------- | -------------------------------------------------- |
> | `orders` con `clientId`, `branchId`, `status`, `createdAt`, `items` | Commerce            | Historial, frecuencia, recencia, reordenamiento    |
> | `products`, `categories`                                            | Commerce            | Candidatos, categorías, disponibilidad             |
> | `branches`, `branchProductAvailability`                             | Commerce            | Cercanía y disponibilidad por sucursal             |
> | `promotions`                                                        | Commerce            | Beneficios vigentes                                |
> | `addresses`                                                         | Auth                | Coordenadas de entrega y validación de pertenencia |
> | `users`                                                             | Auth                | Identidad y rol                                    |
> | JWT + `X-User-Id`, `X-Roles`, `X-Branch-Id`                         | Gateway → servicios | Garantizar que el feed sea del usuario correcto    |
>
> ### Brechas actuales
>
> - La home pide catálogo, sucursales, pedidos y promociones por separado; el cliente arma el ranking.
> - `myOrders` no expresa una política de historial máximo ni de orden; el frontend trae todos los
>   pedidos y calcula.
> - No existe un endpoint de feed personalizado ni un contrato GraphQL `homeFeed`.
> - No hay preferencias explícitas en `users` ni una colección de intereses.
> - No hay una política única de diversidad, recencia o descubrimiento.
> - El modelo documentado de `promotions` es informativo y no incluye segmentación por categoría,
>   producto o sucursal; el frontend ya maneja esos campos. Hay que verificar el contrato real antes
>   de rankear promociones por afinidad.
> - La dirección seleccionada vive en el cliente (`localStorage`); no hay dirección preferida
>   persistida en el servidor para consistencia multi-dispositivo.
>
> ## 3. Decisión de arquitectura
>
> ### Opción elegida: módulo de personalización dentro de Commerce
>
> ```text
> Store
>   │ GraphQL: homeFeed(input)
>   ▼
> GraphQL Gateway
>   │ 1. GET /v1/addresses/{addressId}   → Auth (valida pertenencia y obtiene lat/lng)
>   │ 2. GET /v1/personalization/home-feed?lat=&lng=... → Commerce
>   ▼
> Commerce Service
>   ├── módulo Personalization
>   ├── lee orders, products, categories, branches, promotions
>   └── devuelve feed hidratado
> ```
>
> **Por qué Commerce:**
>
> - Es dueño de todos los datos principales del feed: pedidos, catálogo, sucursales y promociones.
> - No necesita llamar a Auth para calcular gustos; el gateway le pasa las coordenadas ya validadas.
> - Evita duplicar datos en un servicio nuevo.
> - Respeta la regla: el gateway traduce y compone, no decide reglas de negocio.
>
> ### Opciones descartadas
>
> | Opción                                 | Por qué no                                                                                                             |
> | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
> | Ranking en el Gateway                  | Violaría RQ-GW-12: el gateway no debe tener lógica de negocio.                                                         |
> | Nuevo microservicio de recomendaciones | Duplicaría datos de Commerce o exigiría eventos y sincronización para un volumen que no lo justifica.                  |
> | Motor de ML desde el inicio            | No hay señales de clic/impresión ni volumen que justifiquen el costo; primero hay que medir el ranking determinístico. |
> | Commerce llamando a Auth               | Los servicios primarios no se llaman entre sí; el gateway orquesta la unión.                                           |
> | Guardar el ranking precalculado        | Agrega invalidación y complejidad; con índices y límites de historial alcanza el cálculo on-demand.                    |
>
> ## 4. Alcance funcional del backend
>
> El endpoint debe devolver, en una sola operación:
>
> 1. **Contexto:** si el usuario tiene historial, categoría principal, sucursal favorita y sucursal
>    más cercana.
> 2. **Categorías ordenadas por afinidad.**
> 3. **Para vos:** productos recomendados con motivo y puntaje.
> 4. **Descubrí algo nuevo:** productos de categorías no exploradas.
> 5. **Volvé a pedir:** pedidos entregados recientes y distintos.
> 6. **Promociones:** vigentes y, si el contrato lo permite, ordenadas por afinidad.
>
> El backend **no** devuelve secciones vacías como error: devuelve arreglos vacíos y `hasHistory=false`
> cuando corresponde. El frontend decide si las oculta.
>
> ## 5. Contrato GraphQL propuesto
>
> ### Query
>
> ```graphql
> input HomeFeedInput {
>   addressId: ID
>   lat: Float
>   lng: Float
>   forYouLimit: Int = 8
>   discoveryLimit: Int = 4
>   reorderLimit: Int = 3
> }
>
> type Query {
>   homeFeed(input: HomeFeedInput): HomeFeed!
> }
> ```
>
> Reglas:
>
> - Si viene `addressId`, el gateway lo valida contra Auth y usa sus coordenadas.
> - Si no viene `addressId`, puede usar `lat/lng` para contenido público/no autenticado.
> - Nunca se acepta `userId` desde el cliente: se toma del JWT.
> - `forYouLimit`, `discoveryLimit` y `reorderLimit` tienen topes máximos en el resolver y en el
>   servicio (por ejemplo, 12/8/5) para evitar abuso.
>
> ### Tipos
>
> ```graphql
> enum RecommendationReason {
>   REPEAT
>   FAVORITE_CATEGORY
>   DISCOVERY
>   POPULAR
> }
>
> type ProductRecommendation {
>   product: Product!
>   reason: RecommendationReason!
>   hint: String
>   score: Float!
> }
>
> type NearbyBranch {
>   branch: Branch!
>   distanceMeters: Float!
> }
>
> type HomeFeed {
>   generatedAt: String!
>   hasHistory: Boolean!
>   topCategory: Category
>   favoriteBranch: Branch
>   nearestBranch: NearbyBranch
>   categories: [Category!]!
>   forYou: [ProductRecommendation!]!
>   discovery: [ProductRecommendation!]!
>   reorder: [Order!]!
>   promotions: [Promotion!]!
> }
> ```
>
> Notas:
>
> - `forYou` y `discovery` devuelven productos hidratados; el gateway no necesita hacer N+1 para
>   resolverlos.
> - `reorder` devuelve pedidos del usuario con sus ítems y sucursal suficiente para la tarjeta de la
>   home. El gateway puede usar DataLoader sólo para campos que no vengan hidratados.
> - `hint` es texto de presentación controlado por backend. Si se prefiere no acoplar copy, el
>   frontend puede traducir `reason`; se mantienen ambos para evolucionar sin romper.
>
> ## 6. Contrato REST propuesto — Commerce Service
>
> ### Endpoint
>
> ```http
> GET /v1/personalization/home-feed?lat=-34.6&lng=-58.4&forYouLimit=8&discoveryLimit=4&reorderLimit=3
> Authorization: Bearer <JWT>
> X-User-Id: <uuid>
> X-Roles: customer
> ```
>
> **Acceso:** `customer`. Si el producto necesita home pública, se agrega una variante sin datos
> personales (`GET /v1/personalization/public-feed?lat=&lng=`) o el mismo endpoint con autenticación
> opcional y `hasHistory=false`. Recomendación: empezar con `customer` porque la Tienda ya exige sesión.
>
> ### Respuesta
>
> ```json
> {
>   "generatedAt": "2026-11-18T03:00:00.000Z",
>   "hasHistory": true,
>   "topCategory": { "id": "cat_burgers", "name": "Hamburguesas", "active": true },
>   "favoriteBranch": { "id": "branch_centro", "name": "Centro" },
>   "nearestBranch": {
>     "branch": { "id": "branch_centro", "name": "Centro" },
>     "distanceMeters": 820
>   },
>   "categories": [{ "id": "cat_burgers", "name": "Hamburguesas", "active": true }],
>   "forYou": [
>     {
>       "product": { "id": "prod_1", "name": "Burger doble", "price": 8500, "available": true },
>       "reason": "REPEAT",
>       "hint": "Ya lo pediste",
>       "score": 12.4
>     }
>   ],
>   "discovery": [
>     {
>       "product": { "id": "prod_9", "name": "Ensalada", "price": 6200, "available": true },
>       "reason": "DISCOVERY",
>       "hint": "Nuevo para vos",
>       "score": 0.8
>     }
>   ],
>   "reorder": [
>     {
>       "id": "order_10",
>       "number": "102",
>       "status": "DELIVERED",
>       "createdAt": "2026-11-10T10:00:00.000Z",
>       "total": 21000,
>       "branch": { "id": "branch_centro", "name": "Centro" },
>       "items": [{ "productId": "prod_1", "name": "Burger doble", "quantity": 2 }]
>     }
>   ],
>   "promotions": [{ "id": "promo_1", "name": "2x1 en burgers", "active": true }]
> }
> ```
>
> ### Contrato OpenAPI
>
> - Nuevo documento: `packages/contracts/openapi/commerce/v1/personalization.openapi.yaml`.
> - Schemas compartidos: `ProductRecommendation`, `HomeFeed`, `NearbyBranch`, `RecommendationReason`.
> - Errores con RFC 7807 / envelope existente (`code`, `message`, `path`).
> - El cliente HTTP del gateway se genera desde este OpenAPI; no se escribe a mano.
>
> ## 7. Algoritmo de ranking
>
> ### 7.1 Perfil de gustos
>
> Se calcula on-demand con los últimos pedidos entregados del usuario:
>
> - Ventana: últimos **100 pedidos** o **365 días**, lo que ocurra primero. Configurable.
> - Solo `DELIVERED`; se excluyen `CANCELLED` y pedidos activos.
> - Peso por recencia: vida media de **45 días**.
> - `productScore[productId] += cantidad × recencyWeight`.
> - `categoryScore[categoryId] += cantidad × recencyWeight` usando el producto actual del catálogo.
> - `branchScore[branchId] += recencyWeight`.
> - Si un producto ya no existe en el catálogo, se conserva para el historial pero no suma categoría.
>
> ### 7.2 Para vos
>
> Candidatos: productos `available=true`, opcionalmente filtrados por disponibilidad de la sucursal
> más cercana si el contrato lo permite.
>
> Puntaje base:
>
> ```text
> score =
>   productScore × 3
>   + categoryScore × 1.5
>   + (producto ya pedido ? 2 : 0)
>   + (categoría en top 3 ? 1 : 0)
>   + desempate estable por orden de catálogo
> ```
>
> Reglas:
>
> - Diversidad: máximo **2 productos por categoría** en la primera pasada.
> - Si faltan slots, se completa con el excedente en orden de score.
> - Se excluyen productos no disponibles y los ya mostrados en otra sección.
> - `reason`:
>   - `REPEAT` si el producto fue comprado;
>   - `FAVORITE_CATEGORY` si pertenece a una categoría con historial;
>   - `DISCOVERY` si pertenece a una categoría sin historial;
>   - `POPULAR` sólo en el fallback de usuario nuevo.
>
> ### 7.3 Descubrí algo nuevo
>
> - Candidatos de categorías **sin historial**.
> - Se excluyen productos ya comprados y los ya devueltos en `forYou`.
> - Si no hay suficientes categorías nuevas, se completa con productos no comprados de categorías
>   conocidas.
> - Máximo 2 por categoría.
> - Si el usuario no tiene historial, devuelve `[]`.
>
> ### 7.4 Volvé a pedir
>
> - Pedidos `DELIVERED` con ítems, ordenados por `createdAt` descendente.
> - Deduplicar por firma `branchId + productIds ordenados` para no repetir tres tarjetas iguales.
> - Máximo 3.
> - No se valida stock acá: el `POST /v1/orders/{id}/repeat` existente ya lo hace al crear el carrito.
> - No se agrega lógica de repetición nueva.
>
> ### 7.5 Categorías
>
> - Se devuelven todas las categorías activas.
> - Se ordenan por `categoryScore` descendente; las sin historial mantienen el orden del catálogo.
> - No se eliminan categorías: el frontend conserva el carrusel completo.
>
> ### 7.6 Promociones
>
> - Se devuelven sólo promociones vigentes (`active` y fechas).
> - Si el contrato real expone `categoryIds`, `productIds` o `branchIds`, se ordenan por afinidad.
> - Si el modelo documentado sigue siendo informativo, se ordenan por prioridad/fecha y **no se
>   inventan segmentaciones**.
> - Decisión pendiente: confirmar el contrato real de promociones antes de implementar esta parte.
>
> ### 7.7 Usuario nuevo o sin historial
>
> - `hasHistory=false`.
> - `forYou` puede devolver productos populares del catálogo si el negocio quiere; si no, `[]`.
> - `discovery=[]`, `reorder=[]`.
> - Categorías en orden original.
> - Promociones vigentes sin personalización.
> - `nearestBranch` se calcula igual si hay coordenadas.
>
> ## 8. Cambios por capa
>
> ### Auth Service
>
> **Fase 1**
>
> - Ningún cambio de contrato.
> - Se sigue usando `GET /v1/addresses/{addressId}` para validar pertenencia y obtener coordenadas.
> - El gateway llama a Auth; Commerce no.
>
> **Fase 2 (opcional)**
>
> - `users.preferences`: categorías favoritas explícitas, restricciones alimentarias y
>   `defaultAddressId`.
> - Endpoints:
>   - `GET /v1/me/preferences`
>   - `PATCH /v1/me/preferences`
> - El gateway pasa las preferencias como contexto al feed de Commerce.
>
> ### Commerce Service
>
> - Nuevo módulo `Personalization`:
>   ```text
>   controller → orchestrator → ranking service → repositorios de orders/catalog/branches/promotions
>   ```
> - Nuevo endpoint REST `/v1/personalization/home-feed`.
> - Funciones puras de ranking separadas del acceso a datos para testear sin Mongo.
> - No se modifica `POST /v1/orders/{id}/repeat`.
> - No se duplica lógica de carrito, stock ni estados.
>
> ### GraphQL Gateway
>
> - Nuevo tipo `HomeFeed` y query `homeFeed`.
> - Resolver:
>   1. toma `userId` del JWT;
>   2. si hay `addressId`, valida y obtiene coordenadas desde Auth;
>   3. llama al endpoint REST de Commerce;
>   4. mapea la respuesta al schema GraphQL.
> - No calcula scores ni reglas de negocio.
> - Aplica RBAC (`customer`), rate limit y timeouts.
> - Si Commerce falla, devuelve error GraphQL estándar; el frontend decide fallback.
>
> ### Delivery Service
>
> - Sin cambios. No participa del feed.
>
> ### Frontend
>
> - Migración gradual con feature flag, por ejemplo `VITE_HOME_FEED=true`.
> - Nueva query `homeFeed` en `@repo/api` y mapeo a tipos de `@repo/domain`.
> - Mientras el flag está apagado o el endpoint falla, se conserva el cálculo actual del cliente.
> - Cuando el backend esté estable:
>   - la home usa `homeFeed` como fuente principal;
>   - el cálculo local queda sólo como fallback de resiliencia;
>   - se elimina la duplicación de pesos para evitar drift.
>
> ## 9. Modelo de datos e índices
>
> ### Fase 1: sin colecciones nuevas
>
> Se leen colecciones existentes:
>
> - `orders`
> - `products`
> - `categories`
> - `branches`
> - `branchProductAvailability`
> - `promotions`
>
> ### Índices recomendados
>
> ```text
> orders:   { clientId: 1, status: 1, createdAt: -1 }
> orders:   { clientId: 1, createdAt: -1 }
> products: { available: 1, categoryId: 1 }
> categories: { active: 1 }
> branches: { active: 1 }
> promotions: { active: 1, startDate: 1, endDate: 1 }
> ```
>
> `branchProductAvailability` ya tiene índice único `(branchId, productId)` según la especificación.
>
> ### Fase 2: preferencias explícitas
>
> ```text
> users.preferences: {
>   favoriteCategoryIds: [ObjectId],
>   dietaryRestrictions: [string],
>   defaultAddressId: ObjectId | null,
>   updatedAt: Date
> }
> ```
>
> ### Fase 3: feedback de recomendaciones (opcional)
>
> ```text
> recommendationEvents: {
>   _id, userId, section, productId?, orderId?,
>   event (impression|click|dismiss|add_to_cart),
>   createdAt, expiresAt
> }
> ```
>
> - TTL index para no acumular datos indefinidamente.
> - Requiere consentimiento y política de privacidad.
> - No es necesario para la primera versión.
>
> ## 10. Seguridad y privacidad
>
> - **Identidad:** el `userId` sale siempre del JWT; nunca de un parámetro del cliente.
> - **Dirección:** validar que `addressId` pertenezca al usuario antes de usar sus coordenadas.
> - **Aislamiento:** el feed sólo lee pedidos del `userId` autenticado.
> - **RBAC:** `customer` para el feed personalizado; roles administrativos no lo necesitan.
> - **Logs:** no registrar direcciones, coordenadas exactas ni tokens. Si se necesita debugging,
>   usar `requestId` y coordenadas redondeadas/geohash.
> - **Rate limiting:** el feed es una consulta relativamente costosa; limitar por usuario/IP.
> - **Datos locales del frontend:** las vistas recientes siguen siendo del navegador y por usuario;
>   no se envían al backend en fase 1.
> - **Preferencias:** sólo el propio usuario puede leerlas/modificarlas.
>
> ## 11. Rendimiento y caché
>
> - Cálculo O(pedidos + productos), acotado por la ventana de historial.
> - Límite de historial y de candidatos; no se trae el catálogo completo si se puede filtrar por
>   categorías y disponibilidad.
> - Objetivo inicial: **p95 < 300 ms** para el endpoint de Commerce en entorno de prueba.
> - No implementar caché distribuida en fase 1: no hay Redis en la arquitectura documentada.
> - Si hace falta, fase 2:
>   - caché en memoria por instancia, TTL 60 s, clave `userId + geohash + límites`;
>   - invalidación al crear un pedido o cambiar una promoción;
>   - no cachear datos de otro usuario.
> - El gateway puede usar DataLoader para resolver referencias que no vengan hidratadas, nunca para
>   cachear el feed personalizado.
>
> ## 12. Etapas de implementación
>
> ### Etapa 0 — Definición y contratos
>
> - Confirmar contrato real de promociones.
> - Definir OpenAPI `personalization.openapi.yaml`.
> - Definir tipos GraphQL `HomeFeed`, `ProductRecommendation`, `NearbyBranch`.
> - Definir feature flag del frontend y estrategia de fallback.
>
> **Salida:** contratos revisados y aprobados. Sin código de negocio.
>
> ### Etapa 1 — Ranking puro en Commerce
>
> - Implementar perfil de gustos, ranking, diversidad, descubrimiento, reordenamiento y promociones.
> - Tests unitarios con fixtures, sin Mongo.
> - Definir constantes: ventana de historial, vida media, límites, máximo por categoría.
>
> **Dependencia:** etapa 0.
>
> ### Etapa 2 — Repositorios y endpoint REST
>
> - Consultas optimizadas e índices.
> - `GET /v1/personalization/home-feed`.
> - Validación de entrada y errores RFC 7807.
> - Tests de integración con Mongo de prueba.
> - Medición de latencia.
>
> **Dependencia:** etapa 1.
>
> ### Etapa 3 — Gateway GraphQL
>
> - Query `homeFeed`, tipos y resolver.
> - Validación de `addressId` contra Auth.
> - RBAC, rate limit, timeouts y errores.
> - Tests de resolver con REST mockeado.
>
> **Dependencia:** etapas 0 y 2.
>
> ### Etapa 4 — Migración del frontend
>
> - Hook `useHomeFeed` en `@repo/api`.
> - Feature flag y fallback al cálculo actual.
> - Comparación de resultados en staging.
> - Pruebas de regresión de la home.
>
> **Dependencia:** etapa 3.
>
> ### Etapa 5 — Operación y métricas
>
> - Logs estructurados y trazas con `requestId`.
> - Métricas: latencia, cantidad de secciones, errores, fallback.
> - Revisión de performance y ajustes de límites.
>
> **Dependencia:** etapa 4.
>
> ### Etapa 6 — Evolución (opcional)
>
> - Preferencias explícitas.
> - Dirección preferida persistida.
> - Eventos de impresión/clic.
> - A/B testing y ajuste de pesos.
> - Evaluar ML sólo con volumen y métricas suficientes.
>
> ## 13. Pruebas y criterios de aceptación
>
> ### Unitarias
>
> - Perfil con pedidos entregados, cancelados y activos.
> - Recencia: un pedido viejo pesa menos que uno reciente.
> - Diversidad: no más de 2 por categoría cuando hay alternativas.
> - Productos no disponibles excluidos.
> - Descubrimiento no repite comprados ni recomendados.
> - Reordenamiento deduplica pedidos iguales.
> - Promociones: vigencia y orden según contrato disponible.
> - Usuario nuevo: sin historial, sin reordenamiento, sin descubrimiento.
>
> ### Integración
>
> - `GET /v1/personalization/home-feed` devuelve sólo pedidos del `X-User-Id`.
> - `addressId` de otro usuario devuelve 403/404.
> - Sin coordenadas, no hay `nearestBranch` pero el feed sigue funcionando.
> - Producto pausado o no disponible no aparece.
> - Errores de Mongo/contrato se traducen al formato estándar.
>
> ### Gateway
>
> - `homeFeed` exige JWT para datos personalizados.
> - El resolver no calcula scores.
> - `addressId` inválido no rompe el resto del schema.
> - Timeout de Commerce devuelve error controlado.
>
> ### Frontend
>
> - Con `homeFeed` disponible, la home muestra las mismas secciones que la versión local.
> - Con `homeFeed` caído, el fallback local sigue funcionando.
> - No hay regresiones en pedidos activos, hero, categorías, promociones ni CTA.
> - No se mezclan recomendaciones entre usuarios.
>
> ### Criterios de aceptación
>
> - Un usuario nuevo recibe catálogo/populares y no ve secciones que requieren historial.
> - Un usuario con historial recibe `forYou`, `discovery` y `reorder` coherentes.
> - Ningún producto no disponible aparece.
> - El feed es determinístico para los mismos datos y fecha.
> - p95 del endpoint dentro del objetivo acordado.
> - No se expone información de otro usuario.
> - El contrato es aditivo: las queries actuales siguen funcionando.
>
> ## 14. Riesgos técnicos y mitigaciones
>
> | Riesgo                                | Impacto                                  | Mitigación                                                                                  |
> | ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
> | Poner el ranking en el Gateway        | Rompe la arquitectura                    | Mantenerlo en Commerce; revisión de código explícita.                                       |
> | Duplicar lógica frontend/backend      | Resultados distintos                     | Feature flag, comparación en staging y eliminación del cálculo local como fuente principal. |
> | Historial grande                      | Latencia                                 | Ventana de 100 pedidos/365 días + índices + límites.                                        |
> | Contrato de promociones inconsistente | Ranking incorrecto o campos inexistentes | Confirmar OpenAPI real; si no hay segmentación, rankear sólo por vigencia/prioridad.        |
> | Productos borrados                    | Categorías huérfanas                     | Conservar snapshot del pedido; ignorar productos inexistentes para afinidad.                |
> | Dirección no persistida               | Falta de contexto multi-dispositivo      | Fase 2: `defaultAddressId` en Auth.                                                         |
> | Datos sensibles en logs               | Privacidad                               | Logs sin coordenadas exactas ni PII; `requestId`.                                           |
> | Caché con datos cruzados              | Privacidad                               | Clave por usuario; no cachear si no hay aislamiento claro.                                  |
> | Dependencia de Commerce               | Home caída                               | Fallback del frontend al cálculo local mientras se estabiliza.                              |
>
> ## 15. Migración y compatibilidad
>
> 1. El endpoint y la query son **aditivos**; no se elimina nada del contrato actual.
> 2. El frontend mantiene el flujo actual como fallback.
> 3. Se compara `homeFeed` contra el cálculo local en staging con usuarios de prueba.
> 4. Se habilita por porcentaje o por flag.
> 5. Cuando la métrica de errores y latencia esté estable, se usa como fuente principal.
> 6. La lógica local se conserva sólo para resiliencia; no se agregan nuevas reglas allí.
> 7. Cualquier cambio incompatible de REST va a `/v2`; en GraphQL se marca `@deprecated`.
>
> ## 16. Decisiones pendientes
>
> 1. **Promociones:** confirmar si el contrato real tiene `categoryIds`, `productIds`, `branchIds`,
>    `priority` y `scope`. Si no, la personalización de promociones queda limitada a vigencia.
> 2. **Home pública:** definir si `homeFeed` será sólo `customer` o si tendrá variante pública sin
>    historial. La Tienda hoy exige sesión, pero la especificación describe la home como pública.
> 3. **Dirección preferida:** ¿se persiste en Auth para consistencia multi-dispositivo o se sigue
>    enviando la selección del cliente?
> 4. **Disponibilidad por sucursal:** ¿el feed filtra por la sucursal más cercana o sólo por
>    disponibilidad global? La sucursal se asigna al confirmar; filtrar por sucursal puede ocultar
>    productos que sí estarían disponibles en otra sucursal.
> 5. **Preferencias explícitas:** ¿categorías favoritas y restricciones alimentarias son parte del
>    perfil del usuario o de un módulo de Commerce?
> 6. **Eventos de interacción:** ¿se van a recolectar con consentimiento y TTL o se mantiene sólo el
>    historial de pedidos en la primera versión?
>
> ## 17. Resultado esperado
>
> Un endpoint `homeFeed` que:
>
> - devuelve en una sola llamada el contenido personalizado de la home;
> - mantiene la lógica de negocio en Commerce y el gateway fino;
> - funciona para usuarios nuevos y con historial;
> - respeta disponibilidad, pertenencia de la dirección y privacidad;
> - permite que el frontend migre sin romper la experiencia actual;
> - deja preparado el camino para preferencias explícitas, métricas y, si se justifica, ML.
>
> ## 18. Relación con el plan de frontend
>
> - `planPersonalizacionHome.md` sigue siendo válido como **primera versión y fallback**.
> - Este plan es la **evolución server-side**.
> - No se deben mantener dos algoritmos como fuentes de verdad a largo plazo: cuando `homeFeed` esté
>   estable, el backend manda y el cliente sólo conserva un fallback mínimo.

## Informe

- Resumen: el usuario pidió revisar el plan de personalización de la home contra el código real.
- Objetivo: detectar supuestos falsos y ajustes necesarios antes de implementar.
- Qué se hizo: se compararon los contratos GraphQL/REST, los modelos de Commerce y Auth, la
  estructura de dominios, OpenAPI y la documentación funcional.
- Puntos clave:
  - El plan es viable, pero los tipos GraphQL actuales exigen objetos completos, no "id + nombre".
  - El ranking no debe inyectar repositorios de otros dominios: corresponde un orchestrator.
  - Las promociones ya tienen segmentación; esa duda queda resuelta.
  - No existen `packages/contracts` ni codegen: la frase "el cliente se genera" hoy es falsa.
  - El frontend y `planPersonalizacionHome.md` viven en otro repositorio.
  - La spec describe la home como pública; el plan propone `customer`.
- Siguiente paso: corregir el contrato y la estructura del módulo, y decidir home pública o privada.
