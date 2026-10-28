# Validar direcciones con Geoapify

- Fecha: 2026-10-27T21:06:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> las direcciones las tenes que validar con geoapify esta es la api key: <redacted>. No queremos direcciones que no existan. asegurate de eso. Las coordenadas se tienen que correlacionar con las direccionees, usá geoapify si lo necesitas para verificar eso tambien

## Informe

- Resumen: el usuario pidió validar todas las direcciones del seed con Geoapify y asegurar que las coordenadas coincidan.
- Objetivo: que la demo no muestre direcciones inventadas ni puntos en lugares incorrectos.
- Qué se hizo: se geocodificaron las direcciones, se reemplazaron las que no existían y se ajustaron las coordenadas de clientes y sucursales.
- Puntos clave:
  - 33 direcciones verificadas con número de puerta y coordenadas exactas.
  - Se agregó `npm run seed:verify-addresses` para repetir el control.
  - La clave se lee de `GEOAPIFY_API_KEY`; no queda escrita en el repositorio.
- Siguiente paso: ninguno.
