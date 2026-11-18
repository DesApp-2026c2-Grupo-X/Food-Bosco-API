# Corrección del plan de personalización de la home

- Fecha: 2026-11-18T01:03:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> Corregilo

## Informe

- Resumen: el usuario pidió corregir el plan de personalización con los hallazgos de la revisión.
- Objetivo: dejar una versión del plan que coincida con el código real y se pueda implementar.
- Qué se hizo: se reescribió el plan como versión 2 y se agregó al índice de documentación.
- Puntos clave:
  - El feed ahora usa objetos completos y tipos nuevos para promociones y reordenamiento.
  - La estructura del módulo pasa a orchestrator con funciones de ranking puras.
  - Los estados REST quedan en minúscula.
  - Se aclara que identidad sale del JWT y que no existe codegen de OpenAPI.
  - La Etapa 4 del frontend queda como entrega a otro repositorio.
  - Quedan 7 decisiones pendientes, con recomendación para cada una.
- Siguiente paso: resolver las decisiones D1 (home pública o privada) y D2 (OpenAPI).
