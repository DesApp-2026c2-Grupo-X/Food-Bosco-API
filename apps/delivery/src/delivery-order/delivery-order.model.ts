import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { DELIVERY_ORDER_STATUS, DELIVERY_ORDER_STATUS_VALUES } from '../config/constants'
import type { DeliveryOrderStatus } from '../config/constants'

@Schema({ collection: 'deliveryOrders', timestamps: { createdAt: true, updatedAt: false } })
export class DeliveryOrder {
  @Prop({ required: true, unique: true, index: true })
  orderId!: string

  @Prop({ required: true })
  branchId!: string

  @Prop({ required: true, type: { latitude: Number, longitude: Number }, _id: false })
  branchLocation!: { latitude: number; longitude: number }

  @Prop({ required: true, type: { text: String, latitude: Number, longitude: Number }, _id: false })
  deliveryAddress!: { text: string; latitude: number; longitude: number }

  @Prop({
    required: true,
    enum: DELIVERY_ORDER_STATUS_VALUES,
    type: String,
    default: DELIVERY_ORDER_STATUS.ready,
  })
  status!: DeliveryOrderStatus

  @Prop({ default: null, type: String })
  tripId!: string | null

  @Prop({ default: null, type: Date })
  reservedUntil!: Date | null

  @Prop({ default: null, type: [String] })
  rotationRoster!: string[] | null

  @Prop({ default: null, type: Number })
  rotationIndex!: number | null

  @Prop({ default: null, type: Date })
  rotationTurnUntil!: Date | null

  createdAt!: Date
}

export type DeliveryOrderDocument = HydratedDocument<DeliveryOrder>

export const DeliveryOrderSchema = SchemaFactory.createForClass(DeliveryOrder)

DeliveryOrderSchema.index({ status: 1, createdAt: 1 })

// NEW-23: ventana de dedupe de eventos. Pasado este plazo el registro puede purgarse,
// ya que RabbitMQ no reentrega mensajes más viejos que su TTL/expiración.
export const PROCESSED_EVENT_TTL_SECONDS = 7 * 24 * 60 * 60

@Schema({ collection: 'processedEvents', timestamps: { createdAt: true, updatedAt: false } })
export class ProcessedEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string

  @Prop({ required: true, type: Date, default: () => new Date() })
  processedAt!: Date

  createdAt!: Date
}

export type ProcessedEventDocument = HydratedDocument<ProcessedEvent>

export const ProcessedEventSchema = SchemaFactory.createForClass(ProcessedEvent)

// NEW-23: TTL para purgar automáticamente los eventos procesados y evitar que la
// colección de dedupe crezca sin límite.
ProcessedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: PROCESSED_EVENT_TTL_SECONDS })

export interface PublicDeliveryOrder {
  orderId: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: DeliveryOrderStatus
}

export const serializeDeliveryOrder = (doc: DeliveryOrderDocument): PublicDeliveryOrder => ({
  orderId: doc.orderId,
  branchId: doc.branchId,
  branchLocation: doc.branchLocation,
  deliveryAddress: doc.deliveryAddress,
  status: doc.status,
})
