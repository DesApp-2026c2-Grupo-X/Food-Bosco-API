# Validaciones y mensajes en español

- Fecha: 2026-10-29T00:59:09-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> podes ejecuarlo , habian msjs en ingles  , quisiera pasarlos en español y analisar si quedaron validaciones pendienttes  y si es asi implementarlas

## Informe

- Resumen: el usuario pidió ejecutar el fix de validaciones, pasar mensajes al español y completar validaciones faltantes.
- Objetivo: que todos los errores de validación y autorización sean claros, consistentes y en español.
- Qué se hizo: se tradujeron mensajes por defecto y se agregaron validaciones faltantes en DTOs.
- Puntos clave:
  - Auth, Commerce y Delivery ahora traducen 401, 403, 404 y errores genéricos.
  - Gateway traduce el rechazo del seed y los errores de uploads.
  - Se validan turnos (HH:mm), zonas (coordenadas y radio), teléfono de rider, parámetros y campos vacíos en updates.
  - Se actualizaron pruebas unitarias y E2E afectadas.
- Siguiente paso: decidir commit/push de la rama `fix/auditar-validaciones`.
