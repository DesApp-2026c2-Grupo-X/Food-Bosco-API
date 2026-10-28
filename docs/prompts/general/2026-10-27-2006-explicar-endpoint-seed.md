# Explicar el endpoint de seed

- Fecha: 2026-10-27T20:06:37-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> actualmente tenemos un endpoint que hace seed de algunos datos. quiero que veas a fondo que hace y me lo expliques resumidamente

## Informe

- Resumen: el usuario pidió revisar a fondo el endpoint de seed y explicarlo de forma resumida.
- Objetivo: entender qué datos crea y cómo funciona antes de tocarlo o usarlo.
- Qué se hizo: se leyó el controlador del gateway, los tres servicios de seed (commerce, auth, delivery), los archivos de datos y el paquete compartido; se explicó el flujo completo.
- Puntos clave:
  - `POST /seed` del gateway se protege con el header `x-internal-token` y llama en cadena a los otros servicios.
  - Orden: catálogo y sucursales → usuarios y direcciones → pedidos de ejemplo → repartidor y pedido listo.
  - Todo es repetible (no borra nada): crea sólo lo que falta y actualiza direcciones.
  - `npm run seed` es un camino aparte y más limitado (no crea jefes de sucursal ni pedidos).
- Siguiente paso: ninguno.
