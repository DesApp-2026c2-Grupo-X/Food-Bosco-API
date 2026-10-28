# Extender el seed actual o crear uno nuevo

- Fecha: 2026-10-27T20:38:52-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> que vas a hacer? crear un nuevo seed y mantener el actual o cambiar el actual

## Informe

- Resumen: el usuario preguntó si vamos a crear un seed nuevo aparte o a modificar el que ya existe.
- Objetivo: dejar claro el alcance del trabajo antes de implementar.
- Qué se hizo: se recomendó extender el seed actual y se explicó qué se conserva y qué se agrega.
- Puntos clave:
  - Un solo endpoint `POST /seed`, un solo seed por servicio.
  - Lo de hoy (catálogo, sucursales, usuarios base, credenciales) queda igual.
  - Se agregan clientes demo y pedidos aleatorios como una etapa más del mismo flujo.
  - Se reemplaza sólo la regla que hoy impide volver a crear pedidos.
- Siguiente paso: que el usuario confirme si la generación de demo viene activada por defecto.
