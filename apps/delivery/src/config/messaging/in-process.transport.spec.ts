import { Logger } from '@nestjs/common'
import type { OrderStatusChangedEvent } from './events'
import { InProcessTransport } from './in-process.transport'

const event = (overrides: Partial<OrderStatusChangedEvent> = {}): OrderStatusChangedEvent => ({
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: 0, longitude: 0 },
  deliveryAddress: { text: 'Av', latitude: 0.001, longitude: 0 },
  occurredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('InProcessTransport', () => {
  it('entrega el evento al handler del mismo tipo', async () => {
    const transport = new InProcessTransport()
    const handler = jest.fn()

    await transport.subscribe('order.status_changed', handler)
    await transport.publish(event())

    expect(handler).toHaveBeenCalledWith(event())
  })

  it('no entrega eventos de otro tipo', async () => {
    const transport = new InProcessTransport()
    const handler = jest.fn()

    await transport.subscribe('trip.accepted', handler)
    await transport.publish(event())

    expect(handler).not.toHaveBeenCalled()
  })

  it('notifica a todos los handlers suscriptos al mismo tipo', async () => {
    const transport = new InProcessTransport()
    const first = jest.fn()
    const second = jest.fn()

    await transport.subscribe('order.status_changed', first)
    await transport.subscribe('order.status_changed', second)
    await transport.publish(event())

    expect(first).toHaveBeenCalledWith(event())
    expect(second).toHaveBeenCalledWith(event())
  })

  it('publicar sin suscriptores resuelve sin efecto', async () => {
    const transport = new InProcessTransport()

    await expect(transport.publish(event())).resolves.toBeUndefined()
  })

  it('close desuscribe a todos los handlers', async () => {
    const transport = new InProcessTransport()
    const handler = jest.fn()

    await transport.subscribe('order.status_changed', handler)
    await transport.close()
    await transport.publish(event())

    expect(handler).not.toHaveBeenCalled()
  })

  it('acepta handlers asíncronos sin bloquear publish', async () => {
    const transport = new InProcessTransport()
    const handler = jest.fn().mockResolvedValue(undefined)

    await transport.subscribe('order.status_changed', handler)
    await expect(transport.publish(event())).resolves.toBeUndefined()

    expect(handler).toHaveBeenCalledWith(event())
  })

  // NEW-22: el handler se ejecuta dentro de un wrapper con try/catch; un rechazo no
  // debe escapar como unhandledRejection ni romper el transporte.
  describe('NEW-22: aislamiento de errores del handler', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve))

    afterEach(() => jest.restoreAllMocks())

    it('captura el rechazo del handler y lo loguea sin romper el transporte', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const transport = new InProcessTransport()
      const handler = jest.fn().mockRejectedValue(new Error('handler caído'))

      await transport.subscribe('order.status_changed', handler)
      await expect(transport.publish(event())).resolves.toBeUndefined()
      await flush()

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('handler caído'))
    })

    it('captura también un throw sincrónico del handler', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const transport = new InProcessTransport()
      const handler = jest.fn(() => {
        throw new Error('boom')
      })

      await transport.subscribe('order.status_changed', handler)
      await expect(transport.publish(event())).resolves.toBeUndefined()
      await flush()

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'))
    })

    it('un handler que falla no impide notificar a los demás suscriptores', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const transport = new InProcessTransport()
      const failing = jest.fn().mockRejectedValue(new Error('handler caído'))
      const healthy = jest.fn().mockResolvedValue(undefined)

      await transport.subscribe('order.status_changed', failing)
      await transport.subscribe('order.status_changed', healthy)
      await transport.publish(event())
      await flush()

      expect(failing).toHaveBeenCalledWith(event())
      expect(healthy).toHaveBeenCalledWith(event())
    })
  })
})
