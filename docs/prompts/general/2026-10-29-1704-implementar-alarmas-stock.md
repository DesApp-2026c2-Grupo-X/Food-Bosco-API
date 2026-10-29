# Implementar alarmas de stock mínimo

- Fecha: 2026-10-29T17:04:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> okey, implementá el plan con ese arreglo en el seed y tambien con las mejoras y sugerencias que me propusiste.
>
> respuestas a las preguntas del final del plan:
>
> 1. si, prefiero quantity <= minQuantity
> 2. Prefiero que venga vacio
> 3. si. incluilo

## Informe

- Resumen: el usuario aprobó el plan de alarmas de stock mínimo con actualización del seed y las mejoras propuestas.
- Objetivo: agregar cantidad mínima (`minQuantity`) al crear y editar ingredientes, inicializar el stock por sucursal automáticamente y exponer los datos en la API REST y el Gateway GraphQL.
- Qué se hizo: se extendió el modelo, DTOs, repositorio, orquestadores, seed y schema GraphQL de ingredientes y stock.
- Puntos clave:
  - Se agregó `minQuantity` (entero mayor o igual a 0, por defecto `0`) en `Ingredient`, DTOs y `IngredientInput` de GraphQL.
  - Se actualizó el seed para incluir `minQuantity` en todos los ingredientes, actualizar en base de datos los ingredientes existentes con `minQuantity === 0`, y dejar ingredientes en `outOfStock` y `lowStock` en la demo.
  - Al crear un ingrediente o una sucursal se inicializan automáticamente las filas de `branchStock` con `quantity: 0`.
  - Se actualizaron y ejecutaron todos los tests unitarios, typecheck y linter.
- Siguiente paso: probar el flujo completo junto con el frontend en los paneles de sucursal y super admin.
