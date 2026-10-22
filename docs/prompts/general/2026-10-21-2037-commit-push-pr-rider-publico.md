# Commit, push y PR del auto-registro de rider

- Fecha: 2026-10-21T20:37:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> commiteá, push y pr

## Informe

- Resumen: el usuario pidió guardar los cambios pendientes, subirlos al repositorio y abrir una propuesta de cambio (PR).
- Objetivo: publicar el cambio que vuelve público el registro de repartidores (auto-registro).
- Qué se hizo: se revisaron los cambios, se ajustó un test y se validó con lint, types y tests.
- Puntos clave:
  - `register-rider` ya no exige `super_admin` en auth ni en el gateway.
  - Los tests y la documentación reflejan que el alta de repartidor es pública.
  - El alta por administrador (`POST /v1/users/riders`) sigue siendo sólo `super_admin`.
- Siguiente paso: revisar y aprobar el PR.
