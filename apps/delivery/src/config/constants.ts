export const ROLES = {
  rider: 'rider',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_VALUES: Role[] = [ROLES.rider]

export const TRIP_STATUS = {
  offered: 'offered',
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
} as const

export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS]

export const TRIP_STATUS_VALUES: TripStatus[] = [
  TRIP_STATUS.offered,
  TRIP_STATUS.active,
  TRIP_STATUS.completed,
  TRIP_STATUS.cancelled,
]

export const RIDER_STATUS = {
  offline: 'offline',
  free: 'free',
  onTrip: 'on_trip',
} as const

export type RiderStatus = (typeof RIDER_STATUS)[keyof typeof RIDER_STATUS]

export const RIDER_STATUS_VALUES: RiderStatus[] = [
  RIDER_STATUS.offline,
  RIDER_STATUS.free,
  RIDER_STATUS.onTrip,
]

export const DELIVERY_ORDER_STATUS = {
  ready: 'ready',
  reserved: 'reserved',
  assigned: 'assigned',
} as const

export type DeliveryOrderStatus = (typeof DELIVERY_ORDER_STATUS)[keyof typeof DELIVERY_ORDER_STATUS]

export const DELIVERY_ORDER_STATUS_VALUES: DeliveryOrderStatus[] = [
  DELIVERY_ORDER_STATUS.ready,
  DELIVERY_ORDER_STATUS.reserved,
  DELIVERY_ORDER_STATUS.assigned,
]

export const ORDER_STATUS = {
  readyForDelivery: 'ready_for_delivery',
  onTheWay: 'on_the_way',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const

export const ERROR_CODES = {
  riderNotFound: 'RIDER_NOT_FOUND',
  riderOffline: 'RIDER_OFFLINE',
  locationRequired: 'LOCATION_REQUIRED',
  offerNotFound: 'OFFER_NOT_FOUND',
  offerExpired: 'OFFER_EXPIRED',
  tripNotFound: 'TRIP_NOT_FOUND',
  orderNotInTrip: 'ORDER_NOT_IN_TRIP',
  invalidTripStatus: 'INVALID_TRIP_STATUS',
  validationError: 'VALIDATION_ERROR',
  forbidden: 'FORBIDDEN',
  unauthenticated: 'UNAUTHENTICATED',
  notFound: 'NOT_FOUND',
  internal: 'INTERNAL_SERVER_ERROR',
} as const

export const HEADERS = {
  authorization: 'authorization',
  userId: 'x-user-id',
  roles: 'x-user-roles',
  branchId: 'x-branch-id',
  requestId: 'x-request-id',
  internalToken: 'x-internal-token',
} as const
