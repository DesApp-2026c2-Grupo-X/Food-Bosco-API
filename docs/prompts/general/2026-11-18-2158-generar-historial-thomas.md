# Historial demo para Thomas y verificación de la home

- Fecha: 2026-11-18T21:58:00-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> generame historial para el usuario thomas así puedo ver como funciona esta feature

## Informe

- Resumen: el usuario pidió datos de historial para Thomas para probar la home personalizada.
- Objetivo: ver las secciones `forYou`, `discovery` y `reorder` con datos reales.
- Qué se hizo: se agregaron 10 pedidos entregados recientes y una categoría demo de Sushi con productos, y se verificó el feed por REST y GraphQL.
- Puntos clave:
  - Thomas es `cliente@foodbosco.local`; contraseña `Cliente123!`.
  - Los pedidos nuevos están en el lote `personalization-demo-thomas`.
  - La categoría Sushi no tiene historial, por lo que aparece en “Descubrí algo nuevo”.
  - El feed devuelve categoría principal Hamburguesas, sucursal Centro y 3 pedidos para repetir.
  - Commerce quedó corriendo en el puerto 4202 para que la Tienda pueda consumirlo.
- Siguiente paso: reiniciar la Tienda para que tome `VITE_HOME_FEED=true` e iniciar sesión con Thomas.
