# Repetir pedido para el cliente

- Fecha: 2026-10-29T13:29:36-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> Trabajá sobre la funcionalidad “Repetir pedido” para el cliente de la aplicación de comida. Antes de implementar, leé los requerimientos funcionales de la carpeta docs y respetalos.
> Permití que el cliente pueda seleccionar un pedido anterior y volver a realizarlo, validando la disponibilidad de los productos, sus precios actuales y cualquier otra condición necesaria antes de confirmar el nuevo pedido.
> Finalmente, documentá el análisis, los cambios realizados, las decisiones técnicas y las tareas pendientes en un archivo Markdown llamado planRepetirPedido.md en el escritorio de mi computadora.

## Informe

- Resumen: el usuario pidió completar la funcionalidad de repetir un pedido anterior del cliente.
- Objetivo: que el cliente pueda rearmar su pedido con productos y precios vigentes, sin agregar cosas no disponibles.
- Qué se hizo: se reforzó la validación del backend y se expusieron los detalles al gateway GraphQL.
- Puntos clave:
  - Se validan productos existentes, disponibles y sus configuraciones.
  - Se recalculan los precios actuales y se informan los cambios.
  - Se devuelven los ítems omitidos con un motivo claro.
  - Se agregaron tests unitarios y end-to-end.
  - Se dejó el análisis completo en `planRepetirPedido.md` del escritorio.
- Siguiente paso: implementar la interfaz visual en la app del cliente cuando el repositorio frontend esté disponible.
