# Coerción restante en disponibilidad del rider

- Fecha: 2026-10-08T17:39:12-03:00
- App: delivery
- Autor del prompt: usuario

## Prompt

> Repo: /Users/tbarenghi/Desktop/repos/unahur/Desarrollo De Aplicaciones/Food-Bosco-API. App `apps/delivery`. Cerrar bug de coerción restante.
>
> **Bug:** `PATCH /v1/riders/me/availability` con `{ online: 'false' }` o `{ online: 123 }` se coacciona a `true` por `enableImplicitConversion` y pasa `@IsBoolean` (debería dar **400 `VALIDATION_ERROR`**). Corregí el `AvailabilityDto` (`src/rider/dto/availability.dto.ts`) con el patrón tipo union + `@Transform` (que recupere el valor crudo y mapee `true/'true'`→true, `false/'false'`→false, y deje pasar cualquier otro para que `@IsBoolean` falle). **No cambies el ValidationPipe global.**
>
> Actualizá/agregá tests: `src/rider/dto/availability.dto.spec.ts` (con `enableImplicitConversion: true`), y en `test/app.e2e-spec.ts` casos `{ online: 'false' }`/`{ online: 123 }` → 400 y que `{ online: false }` ponga al rider offline.
>
> ALCANCE: `apps/delivery/src/rider/**` + `apps/delivery/test/app.e2e-spec.ts`. NO toques otros dominios. NO `git commit`.
> Verde: `npx jest` (unit) + `npx jest --config ./test/jest-e2e.json` (e2e) + `npx tsc --noEmit` + `npx eslint . --max-warnings 0`.
>
> RESPUESTA FINAL: estado, archivos, tests; bugs nuevos.

## Informe

- Resumen: el usuario pidió cerrar el bug por el que `online: 'false'` o `online: 123` se convertían en `true` en la disponibilidad del rider.
- Objetivo: que esos valores inválidos den 400 y que `online: false` deje al rider offline, sin tocar el ValidationPipe global.
- Qué se hizo: se aplicó el patrón de tipo union + `@Transform` que recupera el valor crudo (igual que `shift.dto.ts`/`zone.dto.ts`), y se actualizaron los tests unitarios y e2e.
- Puntos clave:
  - Solo se aceptan booleanos reales; strings y números fallan `@IsBoolean`.
  - El spec unitario corre con coerción implícita activa para reproducir el bug.
  - Se agregó el caso e2e de `online: false` → rider offline y se re-activa para no romper otros tests.
  - Los cuatro comandos de verificación quedaron en verde.
- Siguiente paso: ninguno.
