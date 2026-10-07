# Respuestas — Fundamentación BE (GraphQL Gateway + microservicios REST)

## 1. ¿La idea sigue siendo la base del BE?

Sí. La arquitectura `Frontends → GraphQL Gateway → REST → servicios` está implementada tal cual la describe el PDF:

- Hay una app `apps/gateway` (NestJS + `@nestjs/graphql` con ApolloDriver) que expone `/graphql`, posee el esquema y los resolvers (`apps/gateway/src/graphql/{auth,commerce,delivery}/`), y traduce a REST vía `RestClient` (`apps/gateway/src/rest/rest.client.ts`).
- Concentra JWT, RBAC, rate limiting, DataLoader y health (`apps/gateway/src/{security,throttle,rest,health}/`).
- Los 3 servicios (`apps/auth`, `apps/commerce`, `apps/delivery`) exponen REST `/v1` y son dueños de sus colecciones.

**Desviaciones reales respecto al PDF:** el paquete `packages/contracts/openapi/` no existe; los clientes REST no se generan desde OpenAPI, se escriben a mano con rutas hardcodeadas. No hay endpoints batch `?ids=`.

## 2. Ejemplo concreto: cómo se evita el N+1

En `apps/gateway/src/rest/data-loader.ts` hay un `DataLoader` propio que acumula claves en un `queue` y, en un solo `queueMicrotask`, dispara una única `batchLoadFn(keys)`.

Los resolvers de campos cross-service lo usan. Ej. `Order.client` y `Order.branch` (`apps/gateway/src/graphql/commerce/commerce.fields.resolver.ts`):

```ts
const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).user.load(order.clientId)
```

Los loaders se crean por request y se cachean en el request (`commerce.dataloaders.ts`), así todos los campos de una misma query comparten la misma instancia. El resultado: en vez de N llamadas en cascada por cada fila, las claves se agrupan y se resuelven juntas.

**Advertencia (honestidad):** la mitigación es parcial. `buildByIdLoader` sigue haciendo `Promise.all(keys.map(id => rest.get(.../${id})))`, es decir **una llamada HTTP por id** (no hay `GET /v1/users?ids=...`), y **no deduplica claves repetidas**. Esto está documentado como `KNOWN BUG (RQ-GW-09)` en `apps/gateway/test/graphql-dataloader.e2e-spec.ts:243` (la misma categoría pedida dos veces produce 2 llamadas REST en vez de 1).

## 3. Ejemplo de test de integración del contrato GraphQL ↔ REST

`apps/gateway/test/graphql-commerce.e2e-spec.ts` levanta el `AppModule` real y **simula los servicios REST interceptando `global.fetch`** (helper `apps/gateway/test/downstream.ts`). Cada test envía una query GraphQL y verifica dos cosas: la respuesta GraphQL y la llamada REST que el gateway hizo.

Ejemplo (`graphql-commerce.e2e-spec.ts:163`):

```ts
downstream.setResponder(respondWith({ 'GET /v1/catalog/categories': { data: [rawCategory] } }))
const res = await run(
  'query { categories(activeOnly: true, page: { limit: 2, offset: 1 }) { id name active } }',
  'customer',
).expect(200)
expect((res.body as GraphQLBody).data).toEqual({
  categories: [{ id: 'c1', name: 'Hamburguesas', active: true }],
})
const params = queryParams(callFor('GET', '/v1/catalog/categories').url)
expect(params.get('activeOnly')).toBe('true')
```

Esto verifica el contrato en ambos sentidos: el payload GraphQL que llega al cliente y el método/ruta/query-string que se traduce hacia REST.

## 4. Cómo testear GraphQL y conocer los payloads

- **Explorar el esquema (payloads, inputs, tipos):** en `apps/gateway/src/gateway/gateway.module.ts` están `introspection` y `playground` habilitados fuera de producción. Levantando el gateway (`npm run dev`), `GET http://localhost:4000/graphql` abre Apollo Sandbox/Playground; ahí navegás el SDL completo y armás queries con autocompletado.
- **Consulta programática:** `POST /graphql` con body `{ "query": "..." }` (y `variables` opcional), más el header `Authorization: Bearer <JWT>`. La introspección (`__schema` / `__type`) devuelve todo el esquema para descubrir tipos y campos.
- **Tests e2e:** los `.e2e-spec.ts` de `apps/gateway/test/` usan `supertest` para hacer `POST /graphql` y `gql(query)` (definido en `downstream.ts`) para armar el payload; corren con `npm run test:e2e` (o el script de Jest `jest-e2e.json`).
