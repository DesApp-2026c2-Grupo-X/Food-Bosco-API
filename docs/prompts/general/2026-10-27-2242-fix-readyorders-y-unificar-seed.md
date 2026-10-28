# Corregir error de readyOrders y unificar el seed

- Fecha: 2026-10-27T22:42:42-03:00
- App: general
- Autor del prompt: usuario

## Prompt

> {
> "code": "VALIDATION_ERROR",
> "message": "El campo readyOrders.0.deliveryAddress.text no está permitido",
> "path": "/v1/seed",
> "details": {
> "fields": [
> {
> "field": "readyOrders.0.deliveryAddress.text",
> "message": "El campo readyOrders.0.deliveryAddress.text no está permitido"
> }
> ]
> },
> "requestId": "a7d3cf3b-2348-4950-9bf8-66cffeeb1219"
> } corrió un rato y luego tiró este error. se quedó a medio hacer el seed. otra cosa que quiero es que npm run seed y el endpoint desde postman hagan lo mismo. Tienen que ser iguales

## Informe

- Resumen: el usuario reportó que el seed fallaba al final por una validación de delivery y pidió que `npm run seed` y el endpoint hagan exactamente lo mismo.
- Objetivo: terminar el seed sin errores y tener un solo comportamiento, sin importar cómo se dispare.
- Qué se hizo: se corrigió el DTO de la dirección de entrega y se cambió `npm run seed` para que llame al endpoint del gateway.
- Puntos clave:
  - El campo `text` de la dirección ahora está declarado en su propia clase de validación.
  - `npm run seed` hace un POST a `POST /seed`, igual que Postman.
  - `npm run seed:direct` queda para sólo maestros, sin servicios.
  - Se agregó una prueba end-to-end de delivery para evitar que el error vuelva.
- Siguiente paso: correr `npm run seed -- --reset` para borrar el lote a medio hacer.
