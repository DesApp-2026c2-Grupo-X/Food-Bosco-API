# Implementar seed demo para reportes

- Fecha: 2026-10-27T21:05:49-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> implementalo

## Informe

- Resumen: el usuario pidió implementar el plan de seed con datos de demo para reportes.
- Objetivo: que una demo tenga pedidos, clientes, fechas y precios variados sin duplicar los datos maestros.
- Qué se hizo: se extendió el seed actual con clientes demo, pedidos históricos aleatorios, stock agotado selectivo, reset por lote y verificación de direcciones.
- Puntos clave:
  - `POST /seed` genera 150 pedidos por corrida repartidos en 120 días.
  - Se agregaron 24 clientes demo con direcciones reales.
  - Se puede fijar la semilla, cambiar la cantidad y borrar los lotes anteriores.
  - Los datos maestros siguen siendo idempotentes.
  - Se agregaron pruebas unitarias y una prueba end-to-end de reportes.
- Siguiente paso: ninguno.
