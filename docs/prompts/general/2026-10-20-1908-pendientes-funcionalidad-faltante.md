# Aclaración sobre puntos pendientes

- Fecha: 2026-10-20T19:08:43-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> los puntos pendientes se da xq falta implementar esas funcionalidades ?

## Informe

- Resumen: el usuario preguntó si los pendientes existen porque faltan funcionalidades.
- Objetivo: entender si los pendientes son features faltantes o mejoras de implementación.
- Qué se hizo: se aclaró que la mayoría de las funcionalidades ya existen y los pendientes son validaciones, integridad o pruebas faltantes.
- Puntos clave:
  - La dirección ya se guarda en el pedido; falta verificar que pertenezca al cliente.
  - La numeración de pedidos existe; falla bajo concurrencia por usar `count() + 1`.
  - Los viajes y ofertas existen; sus transiciones no son atómicas.
  - La suite E2E completa de frontend es una deuda de pruebas, no una funcionalidad ausente.
- Siguiente paso: decidir si se abordan ahora o se priorizan para otra iteración.
