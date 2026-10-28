# Correr el seed desde Postman

- Fecha: 2026-10-27T22:28:10-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> como lo hago desde postman?

## Informe

- Resumen: el usuario pidió los pasos para ejecutar el seed desde Postman.
- Objetivo: poder generar los datos de demo sin usar la consola.
- Qué se hizo: se explicó la request (método, URL, header y body) y se agregó una colección lista para importar.
- Puntos clave:
  - Es un POST a `http://localhost:4000/seed`.
  - Necesita el header `x-internal-token`.
  - El body JSON es opcional y define cantidad, días, semilla o reset.
  - La colección incluye cuatro variantes: default, a medida, reset y sólo maestros.
- Siguiente paso: ninguno.
