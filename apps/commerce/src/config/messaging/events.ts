export const ORDER_STATUS_CHANGED_EVENT = 'order.status_changed'
export const TRIP_ACCEPTED_EVENT = 'trip.accepted'
export const TRIP_COMPLETED_EVENT = 'trip.completed'

export interface GeoPointPayload {
  latitude: number
  longitude: number
}

export interface OrderStatusChangedEvent {
  type: typeof ORDER_STATUS_CHANGED_EVENT
  version: number
  eventId: string
  orderId: string
  status: string
  branchId: string
  branchLocation: GeoPointPayload
  deliveryAddress: { text: string; latitude: number; longitude: number }
  occurredAt: string
}

export interface TripAcceptedEvent {
  type: typeof TRIP_ACCEPTED_EVENT
  version: number
  eventId: string
  tripId: string
  riderId: string
  orderIds: string[]
}

export interface TripCompletedEvent {
  type: typeof TRIP_COMPLETED_EVENT
  version: number
  eventId: string
  tripId: string
  riderId: string
  orderIds: string[]
}

export type DomainEvent = OrderStatusChangedEvent | TripAcceptedEvent | TripCompletedEvent
