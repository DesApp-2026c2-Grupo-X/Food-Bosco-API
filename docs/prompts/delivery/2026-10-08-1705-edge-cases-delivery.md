# Edge cases de admin en delivery (e2e)

- Fecha: 2026-10-08T17:05:05-03:00
- App: delivery
- Autor del prompt: usuario

## Prompt

> Repo: /Users/tbarenghi/Desktop/repos/unahur/Desarrollo De Aplicaciones/Food-Bosco-API. App `apps/delivery`. Cerrar últimos sub-casos. NO modifiques `src/` ni tests existentes.
>
> Leé el setup de `apps/delivery/test/delivery-admin.e2e-spec.ts`, `authorization-and-events.e2e-spec.ts` y `test/mongo.ts`.
>
> Creá `apps/delivery/test/admin-edge-cases.e2e-spec.ts` con:
>
> - Token interno inválido (`x-internal-token` incorrecto) → 401 en `POST /v1/zones`, `POST /v1/shifts` y `POST /v1/seed` (los create; los PATCH active ya están cubiertos).
> - ObjectId malformado en path (p. ej. `abc`) en `GET /v1/trips/:tripId`, `GET /v1/zones/:id`, `GET /v1/shifts/:id` → documentá el comportamiento real (si da 500 por CastError, `// KNOWN BUG:`).
> - Autorización `@Roles(rider)` en los PATCH de `/v1/riders/me` (`PATCH /me`, `/me/vehicle`, `/me/availability`, `/me/location`): 401 sin token y 403 con rol `customer`.
>
> Reglas: integración real (app levantada, Mongo real, JWT real), sólo mocks externos (AuthClient, CommerceClient, transporte). No dupliques casos existentes. Verde: `npx jest --config ./test/jest-e2e.json admin-edge-cases --ci` → `npx tsc --noEmit` → `npx eslint . --max-warnings 0`. NO `git commit`.
>
> RESPUESTA FINAL: casos cubiertos + bugs.

## Informe

- Resumen: el usuario pidió cerrar sub-casos de borde del servicio delivery con un nuevo test e2e, sin tocar el código fuente.
- Objetivo: verificar que la seguridad interna, los ids inválidos y los roles de los endpoints de rider se comporten correctamente.
- Qué se hizo: se creó `apps/delivery/test/admin-edge-cases.e2e-spec.ts` con la app real levantada, Mongo en memoria, JWT real y mocks sólo de servicios externos.
- Puntos clave:
  - Token interno incorrecto en los tres POST (`zones`, `shifts`, `seed`) responde 401.
  - Un id no válido (`abc`) en los GET de viaje, zona y turno devuelve 500 en vez de 404.
  - Los PATCH de `/v1/riders/me` responden 401 sin token y 403 con rol `customer`.
  - Los tres comandos de verificación (jest, tsc, eslint) quedaron en verde.
- Siguiente paso: ninguno.
