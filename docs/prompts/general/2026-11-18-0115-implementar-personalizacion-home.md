# Implementación de la personalización de la home (backend)

- Fecha: 2026-11-18T01:15:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> Ya podés implementarlo?

## Informe

- Resumen: el usuario pidió implementar el plan corregido de personalización de la home.
- Objetivo: tener el feed real en Commerce, publicado por GraphQL, con pruebas.
- Qué se hizo: se creó el módulo de personalización, el endpoint REST, la query `homeFeed`, el contrato OpenAPI y la documentación.
- Puntos clave:
  - El ranking es determinístico y vive en funciones puras de Commerce.
  - La home es pública; con JWT agrega las secciones personales.
  - Sólo se leen pedidos entregados del propio usuario.
  - Se agregaron índices para el historial y las consultas del feed.
  - Se sumaron pruebas unitarias y de integración en ambos servicios.
  - Quedan pendientes el frontend, las métricas y las preferencias explícitas.
- Siguiente paso: integrar `homeFeed` en la Tienda desde el repositorio de frontend.
