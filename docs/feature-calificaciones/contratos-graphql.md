# Contratos GraphQL

Todos los contratos se exponen por el gateway (puerto 4000). El frontend no llama REST directamente.

## Tipos

```graphql
type RatingBreakdown {
  rating: Int!
  count: Int!
}

type ReviewComment {
  rating: Int!
  comment: String
  createdAt: String!
}

type OrderReview {
  id: ID!
  orderId: ID!
  customerId: ID!
  branchId: ID!
  branch: Branch
  branchRating: Int!
  branchComment: String
  courierId: ID
  courierRating: Int
  courierComment: String
  createdAt: String!
  updatedAt: String!
}

type OrderReviewStatus {
  canReview: Boolean!
  review: OrderReview
}

type BranchReviewStats {
  branchId: ID!
  averageRating: Float!
  totalReviews: Int!
  distribution: [RatingBreakdown!]!
  comments: [ReviewComment!]!
}

type CourierReviewStats {
  courierId: ID!
  averageRating: Float!
  totalReviews: Int!
  distribution: [RatingBreakdown!]!
  comments: [ReviewComment!]!
}

type BranchRatingRow {
  branchId: ID!
  branch: Branch
  averageRating: Float!
  totalReviews: Int!
}

type CourierRatingRow {
  courierId: ID!
  rider: Rider
  averageRating: Float!
  totalReviews: Int!
}

type ReviewsSummary {
  branchAverageRating: Float!
  branchReviews: Int!
  courierAverageRating: Float!
  courierReviews: Int!
}
```

`Order` incorpora el campo `rider: OrderCourier` con `id`, `firstName` y `lastName`.

## Inputs

```graphql
input CreateOrderReviewInput {
  branchRating: Int!
  branchComment: String
  courierRating: Int
  courierComment: String
}

input ReviewFilterInput {
  from: String
  to: String
  limit: Int
}
```

El input no acepta `orderId`, `branchId`, `courierId` ni `customerId`: se derivan del pedido y del usuario autenticado.

## Mutation

```graphql
createOrderReview(orderId: ID!, input: CreateOrderReviewInput!): OrderReview!
```

Permiso: `customer`. Requiere pedido propio en `delivered`.

## Queries de cliente

```graphql
myOrderReviews: [OrderReview!]!
pendingOrderReviews: [Order!]!
orderReviewStatus(orderId: ID!): OrderReviewStatus!
```

Permiso: `customer`.

## Queries de estadísticas

```graphql
branchReviewStats(branchId: ID, filter: ReviewFilterInput): BranchReviewStats!
courierReviewStats(courierId: ID, filter: ReviewFilterInput): CourierReviewStats!
branchRatingRanking(filter: ReviewFilterInput): [BranchRatingRow!]!
courierRatingRanking(filter: ReviewFilterInput): [CourierRatingRow!]!
reviewsSummary(filter: ReviewFilterInput): ReviewsSummary!
```

- `branchReviewStats`: `branch_admin` (fuerza su sucursal) y `super_admin` (requiere `branchId`).
- `courierReviewStats`: `rider` (fuerza su propio `userId`) y `super_admin` (requiere `courierId`).
- Rankings y resumen: `super_admin`.

## Endpoints REST internos (Commerce)

| Método | Ruta                                    | Rol                           |
| ------ | --------------------------------------- | ----------------------------- |
| `POST` | `/v1/reviews/orders/:orderId`           | `customer`                    |
| `GET`  | `/v1/reviews/orders/:orderId`           | `customer`                    |
| `GET`  | `/v1/reviews/mine`                      | `customer`                    |
| `GET`  | `/v1/reviews/pending`                   | `customer`                    |
| `GET`  | `/v1/reviews/branches/:branchId/stats`  | `branch_admin`, `super_admin` |
| `GET`  | `/v1/reviews/couriers/:courierId/stats` | `rider`, `super_admin`        |
| `GET`  | `/v1/reviews/branches/ranking`          | `super_admin`                 |
| `GET`  | `/v1/reviews/couriers/ranking`          | `super_admin`                 |
| `GET`  | `/v1/reviews/summary`                   | `super_admin`                 |

Parámetros de filtro: `from` (ISO 8601), `to` (ISO 8601), `limit` (1..100).
