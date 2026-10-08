# Credenciales de seed

> **Estado:** VIGENTE · **Fecha:** 2026-10-08. Datos de desarrollo (no usar en producción).

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

## Cómo generar la DB

Vía gateway (orquesta Commerce → Auth → Delivery):

```bash
curl -X POST http://localhost:4000/seed \
  -H "x-internal-token: dev-internal-token"
```

Sin HTTP (escribe directo a las DBs, orden commerce → auth → delivery):

```bash
npm run seed
```

## Overrides

Las contraseñas salen de los defaults de `apps/auth/src/config/env.ts` y se pueden cambiar por env:

- `SEED_SUPER_ADMIN_PASSWORD` (default `Admin123!`)
- `SEED_CUSTOMER_PASSWORD` (default `Cliente123!`)
- `SEED_BRANCH_ADMIN_PASSWORD` (default `Sucursal123!`)
- `SEED_RIDER_PASSWORD` (default `Repartidor123!`)

> ⚠️ Son credenciales de desarrollo. En producción el arranque falla si los secretos quedan en sus valores por defecto (`JWT_SECRET`/`INTERNAL_API_TOKEN`).
