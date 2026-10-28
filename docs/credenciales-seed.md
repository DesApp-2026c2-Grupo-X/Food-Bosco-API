# Credenciales de seed

> **Estado:** VIGENTE · **Fecha:** 2026-10-27. Datos de desarrollo (no usar en producción).

Usuarios creados por el seed (dominio `@foodbosco.local`).

| Email                             | Rol            | Contraseña       | Sucursal      |
| --------------------------------- | -------------- | ---------------- | ------------- |
| `admin@foodbosco.local`           | `super_admin`  | `Admin123!`      | —             |
| `cliente@foodbosco.local`         | `customer`     | `Cliente123!`    | —             |
| `repartidor@foodbosco.local`      | `rider`        | `Repartidor123!` | —             |
| `sucursal@foodbosco.local`        | `branch_admin` | `Sucursal123!`   | (sin asignar) |
| `sucursal.centro@foodbosco.local` | `branch_admin` | `Sucursal123!`   | **Centro**    |
| `sucursal.norte@foodbosco.local`  | `branch_admin` | `Sucursal123!`   | **Norte**     |
| `sucursal.oeste@foodbosco.local`  | `branch_admin` | `Sucursal123!`   | **Oeste**     |

- El `customer` tiene **2 direcciones** sembradas.
- El `rider` arranca con vehículo `Moto Honda CG Titan`.
- El seed también crea categorías, ingredientes, productos, sucursales, parámetros, órdenes de ejemplo y (si hay pedido listo) un pool de delivery.

## Clientes demo (vía gateway)

`POST /seed` crea además **24 clientes demo** con 28 direcciones reales (verificadas con Geoapify) repartidas entre las sucursales Centro, Norte y Oeste.

Se puede pedir **más cantidad** con `clients` (o `SEED_DEMO_CUSTOMERS`). Los clientes extra se generan con nombres realistas, emails únicos (`cliente.demo.N@foodbosco.local`) y **reutilizan las direcciones ya verificadas** (varios clientes pueden vivir en la misma dirección). Máximo: 500.

```bash
npm run seed -- --customers 80
```

```json
{ "clients": 80, "orders": 300 }
```

- Los 24 curados usan `nombre.apellido@foodbosco.local` (ej. `sofia.ramirez@foodbosco.local`).
- Los generados usan `cliente.demo.N@foodbosco.local` (ej. `cliente.demo.25@foodbosco.local`).
- Todos usan la contraseña `SEED_CUSTOMER_PASSWORD` (default `Cliente123!`).
- Se reutilizan entre corridas: no se duplican usuarios ni direcciones.
- Bajar la cantidad **no borra** los clientes ya creados: el reset sólo limpia pedidos demo.

## Pedidos demo

Cada `POST /seed` agrega un **lote nuevo** de pedidos históricos aleatorios (default: 150 pedidos en 120 días):

- Fechas repartidas con picos de mediodía/noche y fines de semana.
- Todos los estados, precios con variación histórica y sucursal por cercanía a la dirección.
- Los maestros (catálogo, sucursales, usuarios base) siguen siendo idempotentes.
- La semilla usada se devuelve en la respuesta (`demo.seed`) para poder repetir el lote.

```bash
# Lote por defecto
curl -X POST http://localhost:4000/seed -H "x-internal-token: dev-internal-token"

# Lote a medida y reproducible
curl -X POST http://localhost:4000/seed \
  -H "x-internal-token: dev-internal-token" \
  -H "content-type: application/json" \
  -d '{"orders":300,"days":90,"seed":42}'

# Borrar los lotes demo anteriores y regenerar
curl -X POST http://localhost:4000/seed \
  -H "x-internal-token: dev-internal-token" \
  -H "content-type: application/json" \
  -d '{"reset":true}'

# Sólo datos maestros (sin clientes ni pedidos demo)
curl -X POST http://localhost:4000/seed \
  -H "x-internal-token: dev-internal-token" \
  -H "content-type: application/json" \
  -d '{"demo":false}'
```

## Verificación de direcciones

Las direcciones del seed se validan contra Geoapify (existencia, número y coincidencia de coordenadas):

```bash
GEOAPIFY_API_KEY=<key> npm run seed:verify-addresses
```

## Cómo generar la DB

La forma recomendada es el gateway (orquesta Commerce → Auth → Commerce → Delivery y crea el escenario completo):

```bash
curl -X POST http://localhost:4000/seed \
  -H "x-internal-token: dev-internal-token"
```

El comando `npm run seed` hace exactamente lo mismo: llama a ese endpoint.

```bash
npm run seed
npm run seed -- --orders 300 --days 90 --seed 42
npm run seed -- --customers 80
npm run seed -- --reset
npm run seed -- --no-demo
npm run seed -- --help
```

## Postman

La colección [`postman/seed.postman_collection.json`](postman/seed.postman_collection.json) trae las requests listas (default, a medida, más clientes, reset y sólo maestros). Importar con **Import → File** y ajustar las variables `gatewayUrl` e `internalToken` si hace falta.

Sólo datos maestros, sin servicios y escribiendo directo a Mongo:

```bash
npm run seed:direct
```

## Overrides

Las contraseñas salen de los defaults de `apps/auth/src/config/env.ts` y se pueden cambiar por env:

- `SEED_SUPER_ADMIN_PASSWORD` (default `Admin123!`)
- `SEED_CUSTOMER_PASSWORD` (default `Cliente123!`)
- `SEED_BRANCH_ADMIN_PASSWORD` (default `Sucursal123!`)
- `SEED_RIDER_PASSWORD` (default `Repartidor123!`)

Pedidos demo (commerce):

- `SEED_DEMO_ENABLED` (default `true`): el gateway genera demo. `false` = sólo maestros.
- `SEED_DEMO_ORDERS` (default `150`): pedidos por corrida.
- `SEED_DEMO_DAYS` (default `120`): ventana histórica.
- `SEED_DEMO_CUSTOMERS` (default `24`): cantidad de clientes demo (1–500). Los extra reutilizan las direcciones verificadas.
- `SEED_DEMO_SEED`: semilla fija para repetir el mismo lote.
- `SEED_DEMO_RESET` (default `false`): borra los lotes demo anteriores antes de generar.

> ⚠️ Son credenciales de desarrollo. En producción el arranque falla si los secretos quedan en sus valores por defecto (`JWT_SECRET`/`INTERNAL_API_TOKEN`).
