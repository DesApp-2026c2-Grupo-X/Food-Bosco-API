import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { TRIP_STATUS, TRIP_STATUS_VALUES } from '../config/constants'
import type { TripStatus } from '../config/constants'

@Schema({ _id: false })
export class TripOrder {
  @Prop({ required: true })
  orderId!: string

  @Prop({ required: true })
  pickupBranchId!: string

  @Prop({ required: true, type: { latitude: Number, longitude: Number }, _id: false })
  pickupLocation!: { latitude: number; longitude: number }

  @Prop({ required: true, type: { text: String, latitude: Number, longitude: Number }, _id: false })
  deliveryAddress!: { text: string; latitude: number; longitude: number }

  @Prop({ required: true, type: String })
  status!: string

  @Prop({ default: null, type: Date })
  pickedUpAt!: Date | null

  @Prop({ default: null, type: Date })
  deliveredAt!: Date | null
}

export const TripOrderSchema = SchemaFactory.createForClass(TripOrder)

@Schema({ _id: false })
export class TripTariffSnapshot {
  @Prop({ required: true, min: 0 })
  baseFare!: number

  @Prop({ required: true, min: 0 })
  perKm!: number

  @Prop({ required: true, min: 0 })
  perOrder!: number
}

export const TripTariffSnapshotSchema = SchemaFactory.createForClass(TripTariffSnapshot)

@Schema({ collection: 'trips', timestamps: { createdAt: true, updatedAt: true } })
export class Trip {
  @Prop({ required: true, index: true })
  riderId!: string

  @Prop({ required: true, enum: TRIP_STATUS_VALUES, type: String, default: TRIP_STATUS.offered })
  status!: TripStatus

  @Prop({ required: true, type: [TripOrderSchema], default: [] })
  orders!: TripOrder[]

  @Prop({ required: true })
  distanceKm!: number

  @Prop({ required: true })
  estimatedMinutes!: number

  @Prop({ required: true })
  estimatedEarnings!: number

  @Prop({
    required: function (this: { isNew?: boolean }) {
      return this.isNew === true
    },
    type: TripTariffSnapshotSchema,
  })
  tariffSnapshot!: TripTariffSnapshot | null

  @Prop({ default: null, type: Number })
  earnings!: number | null

  @Prop({ default: null, type: Date })
  startedAt!: Date | null

  @Prop({ default: null, type: Date })
  completedAt!: Date | null

  @Prop({ default: null, type: Date })
  expiresAt!: Date | null

  @Prop({ default: null, type: String, index: true })
  demoBatchId?: string | null

  createdAt!: Date
  updatedAt!: Date
}

export type TripDocument = HydratedDocument<Trip>

export const TripSchema = SchemaFactory.createForClass(Trip)

export interface PublicTripOrder {
  orderId: string
  pickupBranchId: string
  pickupLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: string
  pickedUpAt: string | null
  deliveredAt: string | null
}

export interface PublicTripTariffSnapshot {
  baseFare: number
  perKm: number
  perOrder: number
}

export interface PublicTrip {
  id: string
  riderId: string
  status: TripStatus
  orders: PublicTripOrder[]
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  tariffSnapshot: PublicTripTariffSnapshot | null
  earnings: number | null
  startedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export const serializeTripOrder = (order: TripOrder): PublicTripOrder => ({
  orderId: order.orderId,
  pickupBranchId: order.pickupBranchId,
  pickupLocation: order.pickupLocation,
  deliveryAddress: order.deliveryAddress,
  status: order.status,
  pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
  deliveredAt: order.deliveredAt?.toISOString() ?? null,
})

export const serializeTrip = (doc: TripDocument): PublicTrip => ({
  id: doc._id.toString(),
  riderId: doc.riderId,
  status: doc.status,
  orders: doc.orders.map(serializeTripOrder),
  distanceKm: doc.distanceKm,
  estimatedMinutes: doc.estimatedMinutes,
  estimatedEarnings: doc.estimatedEarnings,
  tariffSnapshot: doc.tariffSnapshot
    ? {
        baseFare: doc.tariffSnapshot.baseFare,
        perKm: doc.tariffSnapshot.perKm,
        perOrder: doc.tariffSnapshot.perOrder,
      }
    : null,
  earnings: doc.earnings ?? null,
  startedAt: doc.startedAt?.toISOString() ?? null,
  completedAt: doc.completedAt?.toISOString() ?? null,
  expiresAt: doc.expiresAt?.toISOString() ?? null,
  createdAt: doc.createdAt?.toISOString() ?? '',
})
