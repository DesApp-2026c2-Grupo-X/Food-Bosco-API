# Commit, push y PR del pedido cancelado

- Fecha: 2026-10-22T00:30:01-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> commitea, pushea y genera pr a develop

## Informe

- Resumen: el usuario pidió guardar los cambios en un commit, subirlos al repositorio y abrir un pull request contra `develop`.
- Objetivo: publicar el arreglo de cancelación de pedidos en delivery para que se revise e integre.
- Qué se hizo: se revisaron los cambios pendientes de delivery, se dejó registro de la interacción y se preparó el commit, el push y el PR hacia `develop`.
- Puntos clave:
  - Si un pedido se cancela mientras un repartidor lo está llevando, el viaje se cierra y el repartidor vuelve a quedar libre.
  - La ganancia del viaje se reparte según los pedidos realmente entregados.
  - No se puede marcar como retirado o entregado un pedido cancelado.
  - El manejo de eventos de pedido se movió a su propia carpeta (`order-lifecycle`) para separar responsabilidades.
- Siguiente paso: revisar y aprobar el pull request https://github.com/DesApp-2026c2-Grupo-X/Food-Bosco-API/pull/31.
