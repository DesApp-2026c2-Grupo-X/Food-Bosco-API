# Generar más clientes demo

- Fecha: 2026-10-27T22:58:16-03:00
- App: auth
- Autor del prompt: usuario

## Prompt

> y si quiero generar mas clientes?

## Informe

- Resumen: el usuario preguntó cómo generar más clientes demo en el seed.
- Objetivo: poder ampliar la cantidad de clientes sin inventar direcciones.
- Qué se hizo: se agregó la opción `clients` (o `SEED_DEMO_CUSTOMERS`) para pedir hasta 500 clientes; los extra reutilizan las direcciones ya verificadas.
- Puntos clave:
  - `npm run seed -- --customers 80` genera 80 clientes.
  - En Postman, el body acepta `{"clients": 80}`.
  - Los clientes nuevos usan nombres realistas y emails únicos.
  - Las direcciones siguen siendo reales y verificadas con Geoapify.
  - La cantidad de clientes no se borra al reducir el número; sólo se crean los que faltan.
- Siguiente paso: ninguno.
