# Pendings

Temas de la implementación que quedan abiertos a propósito. Cada entrada referencia el
requerimiento o la decisión, y qué falta.

| # | Tema | Referencia | Qué falta |
| --- | --- | --- | --- |
| 1 | Validación de sucursal al crear `branch_admin` | `RQ-AUTH-13` | No se valida la sucursal contra Commerce Service vía REST por ahora (decisión del equipo). Cuando se active: extraer la creación de personal a un orchestrator + un cliente HTTP a `GET /v1/branches/{branchId}` (`COMMERCE_SERVICE_URL` ya está en `config/env.ts`). |
| 2 | Envío de token de recuperación | `RQ-AUTH-09/10` | El token de recuperación se genera y guarda, pero **no se envía** (no hay servicio de email en el alcance). El endpoint responde neutral como exige la spec. |
| 3 | Acceso "interno" a `GET /v1/users/{id}` | `RQ-AUTH-17` | Soportado vía header `X-Internal-Token` (`INTERNAL_API_TOKEN`) además de `super_admin`. El gateway lo usará para resolver `Order.client` cuando exista Commerce. |
| 4 | Resolvers de Commerce/Delivery en el gateway | plan2.md §4 | Solo se implementó el dominio auth del esquema GraphQL. Catalog/Branch/Cart/Order/Stock/Reporting/Config/Delivery quedan para cuando existan sus servicios. |
| 5 | `PageInfo` en GraphQL | plan2.md §2.5 | Se expone `UserPage { data, pageInfo }` para `users`. `myAddresses` queda como lista simple (sin paginación). |
