# Modelo de datos — `OrderReview`

## Colección

`orderReviews` en MongoDB (servicio Commerce).

## Documento

```ts
interface OrderReview {
  _id: ObjectId
  orderId: string // índice único
  customerId: string // índice
  branchId: string // índice
  branchRating: number // entero 1..5
  branchComment: string | null // ≤ 500 caracteres
  courierId: string | null // userId del repartidor; índice
  courierRating: number | null // entero 1..5 o null
  courierComment: string | null // ≤ 500 caracteres
  createdAt: Date
  updatedAt: Date
}
```

## Reglas

- Un pedido tiene como máximo una reseña (`orderId` único).
- La reseña de sucursal siempre existe.
- La reseña de repartidor existe solo si el pedido tuvo `riderId`.
- Los comentarios se recortan; un comentario vacío se guarda como `null`.
- `branchId` y `courierId` se copian del pedido; el cliente no puede imponerlos.
- No se guardan datos personales del cliente en la reseña más allá de `customerId`.

## Índices

```ts
OrderReviewSchema.index({ orderId: 1 }, { unique: true })
OrderReviewSchema.index({ customerId: 1 })
OrderReviewSchema.index({ branchId: 1, createdAt: -1 })
OrderReviewSchema.index({ courierId: 1, createdAt: -1 })
```

Los índices `branchId + createdAt` y `courierId + createdAt` soportan las agregaciones por período. El índice único es la última barrera contra envíos concurrentes.

## Validaciones de entrada

| Campo            | Regla                                                         |
| ---------------- | ------------------------------------------------------------- |
| `branchRating`   | entero entre 1 y 5, obligatorio                               |
| `courierRating`  | entero entre 1 y 5, obligatorio si el pedido tiene repartidor |
| `branchComment`  | opcional, texto, máximo 500 caracteres                        |
| `courierComment` | opcional, texto, máximo 500 caracteres                        |

Las validaciones se aplican dos veces: DTO (`class-validator`) y servicio (defensa ante llamadas internas).

## Agregaciones

- Distribución de 1 a 5 con `$bucket`.
- Promedio y total con `$group` (`$avg`, `$sum`).
- Comentarios recientes con `$match` sobre comentario no vacío, orden descendente y límite.
- Rankings por `$group` + `$sort` + `$limit`.
- Resumen global con `$facet` separando sucursal y repartidor.

Ninguna agregación mezcla `branchRating` con `courierRating`.
