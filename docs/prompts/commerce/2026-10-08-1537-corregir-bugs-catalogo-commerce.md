# Corregir bugs COM-01..COM-09, COM-18 en catálogo de Commerce

- Fecha: 2026-10-08T15:37:16-0300
- App: commerce
- Autor del prompt: usuario

## Prompt

> Repo: /Users/tbarenghi/Desktop/repos/unahur/Desarrollo De Aplicaciones/Food-Bosco-API (monorepo NestJS + Turborepo). Trabajás en `apps/commerce`, SOLO en los dominios product / category / ingredient / promotion.
>
> Hay una lista de bugs documentada en `docs/testing/bug-report.md`, con tests unitarios marcados `// KNOWN BUG:` que hoy fijan la conducta INCORRECTA. Corregí el código para que haga lo ESPERADO y actualizá esos tests para verificar la conducta corregida.
>
> ANTES de escribir código, leé y aplicá estas skills:
>
> - .claude/skills/orchestrator-domain-architecture/SKILL.md
> - .claude/skills/domain-patterns/SKILL.md
> - .claude/skills/high-quality-tests/SKILL.md
> - .claude/skills/modern-code-quality/SKILL.md
>
> Bugs asignados (leé el detalle exacto + test que lo detecta en docs/testing/bug-report.md):
>
> - COM-01 (Media, RQ-CAT-10/11): desactivar un ingrediente usado por la receta de un producto activo debe rechazarse con `INGREDIENT_IN_USE` (el código `ERROR_CODES.ingredientInUse` existe y está muerto). Requiere coordinar product+ingredient: usá un orchestrator según la skill.
> - COM-02 (Alta, RQ-CAT-13): validar `startDate <= endDate` en promociones (create/update). Rechazar con 400/error de dominio.
> - COM-03 (Alta, RQ-CAT-04): validar que la categoría exista al crear/actualizar producto → 404 `CATEGORY_NOT_FOUND`.
> - COM-04 (Alta, RQ-CAT-11): validar que el ingrediente exista al setRecipe/addRecipeItem/updateRecipeItem → 404 `INGREDIENT_NOT_FOUND`.
> - COM-05 (Alta, RQ-CAT-11): quitar un ítem de receta inexistente debe dar 404 `RECIPE_ITEM_NOT_FOUND` (hoy 200), consistente con removeConfigGroup/Option.
> - COM-06 (Media, RQ-CAT-07): grupos de configuración inconsistentes (`required:true` sin `min`; `min > max`) → 400 `VALIDATION_ERROR`.
> - COM-07 (Media, RQ-CAT-11/12): cantidad de receta debe ser `> 0` (hoy `@Min(0)` acepta 0).
> - COM-08 (Media, RQ-CAT-08): `extraPrice` no negativo en opciones.
> - COM-09 (Media, RQ-CAT-05): filtro `available` con valor inválido debe dar 400 (hoy se coacciona a false).
> - COM-10 (Baja): `subId` cae a `''` cuando falta `_id` de subdocumento; devolver identificador válido o error.
> - COM-18 (Baja): categoría con nombre duplicado no debe propagar `E11000` crudo; devolver error de dominio.
>
> ALCANCE ESTRICTO: `apps/commerce/src/{product,category,ingredient,promotion}/**` (incluye sus `*.spec.ts` y `dto/`). NO toques `apps/commerce/test/**` (otro agente), ni `branch/stock/order/cart/parameter`, ni otros apps/packages. NO hagas `git commit`.
>
> Reglas:
>
> - Verificá la causa leyendo el código antes de corregir.
> - Mantené la regla de oro: un servicio primario no llama a otro servicio primario; la coordinación va al orchestrator.
> - Actualizá los `*.spec.ts` afectados (unit) y agregá casos borde/inválidos que falten. No dupliques tests ni busques solo coverage.
> - Si un fix (p.ej. COM-01, COM-10) te obliga a tocar archivos fuera de tu alcance o es ambiguo, NO improvises: marcá ese bug como NEEDS-DECISION con motivo.
> - Ejecutá hasta verde: `npx jest <specs afectados>` y luego `npx jest` (unit completo de commerce). Después `npx tsc --noEmit` y `npx eslint . --max-warnings 0`.
>
> RESPUESTA FINAL (conciso): por bug → STATUS (FIXED / NEEDS-DECISION / ALREADY-FIXED), archivos, tests. Listá bugs NUEVOS detectados (NO corregir): archivo:línea + causa + impacto.

## Informe

- Resumen: el usuario pidió corregir 11 bugs del catálogo de Commerce (productos, categorías, ingredientes y promociones) y actualizar sus tests.
- Objetivo: que el API se comporte según los requisitos (RQ-CAT) y dejar la suite en verde.
- Qué se hizo: se corrigieron validaciones, se crearon dos orchestrators (producto e ingrediente) para coordinar dominios, y se actualizaron los tests.
- Puntos clave:
  - Se respetó la regla de oro: los servicios primarios no se llaman entre sí; la coordinación quedó en orchestrators.
  - Se arreglaron COM-01, 02, 03, 04, 05, 06, 07, 08, 09 y 18.
  - COM-10 quedó marcado como NEEDS-DECISION por ser ambiguo (¿id válido o error?).
  - Pasaron: tests afectados, suite unit completa de Commerce, `tsc` y `eslint`; también el e2e de catálogo.
- Siguiente paso: definir con el usuario la política de COM-10 y los bugs nuevos reportados.
