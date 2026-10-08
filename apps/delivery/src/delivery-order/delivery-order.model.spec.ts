import {
  DeliveryOrderSchema,
  PROCESSED_EVENT_TTL_SECONDS,
  ProcessedEventSchema,
  serializeDeliveryOrder,
} from './delivery-order.model'
import type { DeliveryOrderDocument } from './delivery-order.model'

const hasIndex = (
  schema: { indexes: () => Array<[Record<string, unknown>, Record<string, unknown>]> },
  fields: Record<string, unknown>,
): [Record<string, unknown>, Record<string, unknown>] | undefined =>
  schema.indexes().find(([indexFields]) => JSON.stringify(indexFields) === JSON.stringify(fields))

describe('DeliveryOrderSchema (RQ-DLV-04)', () => {
  it('indexa por status y createdAt para el pool de órdenes listas', () => {
    expect(hasIndex(DeliveryOrderSchema, { status: 1, createdAt: 1 })).toBeDefined()
  })
})

describe('ProcessedEventSchema (NEW-23)', () => {
  it('purga los eventos procesados con un índice TTL sobre processedAt', () => {
    const ttlIndex = hasIndex(ProcessedEventSchema, { processedAt: 1 })

    expect(ttlIndex).toBeDefined()
    expect(ttlIndex?.[1]).toMatchObject({ expireAfterSeconds: PROCESSED_EVENT_TTL_SECONDS })
  })

  it('define una ventana de dedupe positiva y acotada (7 días)', () => {
    expect(PROCESSED_EVENT_TTL_SECONDS).toBe(7 * 24 * 60 * 60)
  })

  it('mantiene el índice único por eventId para el dedupe', () => {
    expect(hasIndex(ProcessedEventSchema, { eventId: 1 })).toBeDefined()
  })

  it('processedAt es un Date requerido que se completa por default', () => {
    const path = ProcessedEventSchema.path('processedAt')
    const options = (path as unknown as { options: { required?: boolean; default?: () => Date } })
      .options

    expect(path.instance).toBe('Date')
    expect(options.required).toBe(true)
    expect(typeof options.default).toBe('function')
    expect(options.default?.()).toBeInstanceOf(Date)
  })
})

describe('serializeDeliveryOrder (DQ-DLV-04)', () => {
  it('expone solo los campos públicos del pool', () => {
    const doc = {
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: 1, longitude: 2 },
      deliveryAddress: { text: 'Av', latitude: 3, longitude: 4 },
      status: 'ready',
    } as unknown as DeliveryOrderDocument

    expect(serializeDeliveryOrder(doc)).toEqual({
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: 1, longitude: 2 },
      deliveryAddress: { text: 'Av', latitude: 3, longitude: 4 },
      status: 'ready',
    })
  })

  it('no expone campos internos de Mongoose', () => {
    const doc = {
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: 1, longitude: 2 },
      deliveryAddress: { text: 'Av', latitude: 3, longitude: 4 },
      status: 'ready',
      _id: 'o1',
      __v: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as unknown as DeliveryOrderDocument

    const result = serializeDeliveryOrder(doc)
    expect(result).not.toHaveProperty('_id')
    expect(result).not.toHaveProperty('__v')
    expect(result).not.toHaveProperty('createdAt')
  })
})
