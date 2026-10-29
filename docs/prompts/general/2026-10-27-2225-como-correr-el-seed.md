# Cómo correr el seed

- Fecha: 2026-10-27T22:25:40-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> que tengo que hacer entonces para correr el seed?

## Informe

- Resumen: el usuario preguntó los pasos concretos para ejecutar el seed nuevo.
- Objetivo: poder levantar los servicios y generar los datos de demo sin dudas.
- Qué se hizo: se listaron los requisitos, los comandos y las opciones del endpoint.
- Puntos clave:
  - Hay que tener MongoDB y las 4 apps arriba.
  - Primero se compila el paquete compartido `seed-utils`.
  - El seed completo se corre con un POST al gateway con el token interno.
  - Se puede repetir, fijar la semilla o resetear los lotes demo.
  - `npm run seed` sólo crea datos maestros.
- Siguiente paso: ninguno.
