# Corregir bugs GW-01 a GW-07 del gateway

- Fecha: 2026-10-08T15:33:00-03:00
- App: gateway
- Autor del prompt: usuario

## Prompt

> Repo: /Users/tbarenghi/Desktop/repos/unahur/Desarrollo De Aplicaciones/Food-Bosco-API (monorepo NestJS + Turborepo). Trabajás SOLO en `apps/gateway`.
>
> Hay una lista de bugs documentada en `docs/testing/bug-report.md`, con tests marcados `// KNOWN BUG:` (unit y e2e) que fijan la conducta INCORRECTA. Corregí el código para que haga lo ESPERADO y actualizá esos tests.
>
> ANTES de escribir código, leé y aplicá estas skills:
>
> - .claude/skills/orchestrator-domain-architecture/SKILL.md
> - .claude/skills/domain-patterns/SKILL.md
> - .claude/skills/high-quality-tests/SKILL.md
> - .claude/skills/modern-code-quality/SKILL.md
>
> Bugs asignados (leé el detalle + test exacto en docs/testing/bug-report.md):
>
> - GW-01 (Alta, RQ-GW-09): el DataLoader no deduplica keys repetidas dentro del mismo lote → hace una llamada REST por parent. Esperado: una llamada por id único por lote. Archivos: `src/rest/data-loader.ts` y `src/graphql/commerce/commerce.dataloaders.ts`. Actualizá `src/rest/data-loader.spec.ts`, `src/graphql/commerce/commerce.dataloaders.spec.ts` y `test/graphql-dataloader.e2e-spec.ts`.
> - GW-02 (Media): `RestClient` no maneja respuestas 2xx sin cuerpo (204): `response.json()` rechaza con SyntaxError. Esperado: resolver vacío/undefined. `src/rest/rest.client.ts` (+ spec).
> - GW-03 (Baja): `mapAddress` produce `NaN` con lat/lng faltantes (GraphQL Float no lo serializa). Esperado: default seguro o error de dominio. `src/graphql/auth/auth.types.*` (+ spec).
> - GW-04 (Media, RQ-GW-07): el formatter de errores GraphQL descarta el `path` REST del downstream y solo conserva `code`. Esperado: preservar el path del servicio (en `extensions`/`path`). `src/graphql/errors/**` + `test/graphql-errors.e2e-spec.ts`.
> - GW-05 (Baja): el filtro de upload descarta el `path` downstream (siempre usa `/v1/uploads`). Esperado: propagarlo. `src/upload/**` + `test/gateway-upload.e2e-spec.ts`.
> - GW-06 (Media, RQ-GW-08/09): falta `TripOrder.order` en el esquema GraphQL (`Cannot query field "order" on type "TripOrder"`). Esperado: resolver Order vía Commerce/DataLoader. `src/graphql/delivery/**` + `test/graphql-dataloader.e2e-spec.ts`.
> - GW-07 (Alta, RQ-CAT-07, ROMPE FLUJO REAL): `createConfigGroup`/`updateConfigGroup` envían `type: 'MULTIPLE'|'SINGLE'` a REST cuando Commerce espera `'multiple'|'single'`, devolviendo 400. El helper `configGroupTypeToRest` existe pero nunca se invoca (a diferencia de `orderStatusToRest`/`roleToRest`). Aplicar el mapeo en los resolvers. Actualizá `test/graphql-commerce.e2e-spec.ts`.
>
> ALCANCE ESTRICTO: `apps/gateway/src/**` y `apps/gateway/test/**`. NO toques otros apps ni packages. NO hagas `git commit`.
>
> Reglas:
>
> - Verificá la causa leyendo el código antes de corregir.
> - Actualizá los specs/e2e que fijan la conducta buggy; agregá casos borde que falten. No dupliques tests.
> - Ejecutá hasta verde: `npx jest <specs>` → `npx jest` (unit completo gateway) → `npx jest --config ./test/jest-e2e.json` (e2e; si da contention re-ejecutá solo) → `npx tsc --noEmit` → `npx eslint . --max-warnings 0`.
>
> RESPUESTA FINAL (conciso): por bug → STATUS (FIXED / NEEDS-DECISION / ALREADY-FIXED), archivos, tests. Listá bugs NUEVOS (NO corregir): archivo:línea + causa + impacto.

## Informe

- Resumen: se corrigieron los 7 bugs del gateway (GW-01 a GW-07) y se actualizaron los tests que fijaban la conducta incorrecta.
- Objetivo: que el gateway cumpla los requisitos RQ-GW y deje de fallar contra los servicios REST reales.
- Qué se hizo: dedupe de keys por lote en el DataLoader; manejo de respuestas 204/vacías; lat/lng con valor por defecto; propagación del `path` del servicio en errores GraphQL y de upload; campo `TripOrder.order` con carga vía DataLoader; y mapeo de `ConfigGroupType` a minúsculas al llamar a Commerce.
- Puntos clave:
  - El DataLoader ahora hace una sola llamada REST por id único dentro de cada tanda.
  - Los errores conservan el `path` del servicio downstream (trazabilidad RQ-GW-07).
  - `createConfigGroup`/`updateConfigGroup` envían `type: 'single'|'multiple'`, como espera Commerce.
  - Suite completa verde: 604 tests unitarios, 173 e2e, typecheck y lint sin errores.
- Siguiente paso: revisar los bugs nuevos reportados (no corregidos por estar fuera del alcance).
