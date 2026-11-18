# Integración de la home con el feed del backend

- Fecha: 2026-11-18T02:16:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> El frontend está en el otro webstorm abierto, pedime permiso para mirarlo e inclusive modificar si necesitas

## Informe

- Resumen: el usuario autorizó revisar y modificar el frontend para conectar la home con el backend.
- Objetivo: implementar la Etapa 4 usando `homeFeed` con un flag y un fallback seguro.
- Qué se hizo: se agregó el hook `useHomeFeed`, el mapeo al dominio, el flag `VITE_HOME_FEED` y la integración en la home.
- Puntos clave:
  - Con el flag activo, la home usa las secciones del backend.
  - Si el flag está apagado o el feed falla, se conserva el cálculo local.
  - Para usuarios nuevos se mantiene “Los más pedidos” del catálogo.
  - Se adaptaron los tipos de reordenamiento sin romper los componentes existentes.
  - Se agregaron pruebas del mapeo, del hook y de la home.
- Siguiente paso: activar `VITE_HOME_FEED=true` en staging y comparar resultados.
