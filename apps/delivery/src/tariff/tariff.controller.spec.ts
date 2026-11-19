import 'reflect-metadata'
import { INTERNAL_KEY } from '../config/security/internal.decorator'
import { TariffController } from './tariff.controller'
import { TariffService } from './tariff.service'

const makeController = () => {
  const service = {
    getActive: jest.fn(),
    listHistory: jest.fn(),
    publish: jest.fn(),
  }
  const controller = new TariffController(service as unknown as TariffService)
  return { controller, service }
}

describe('TariffController (RQ-DLV-08)', () => {
  it.each([
    ['getActive', TariffController.prototype.getActive],
    ['list', TariffController.prototype.list],
    ['publish', TariffController.prototype.publish],
  ] as const)('%s exige el token interno', (_name, handler) => {
    expect(Reflect.getMetadata(INTERNAL_KEY, handler)).toBe(true)
  })

  it('getActive delega en el servicio', async () => {
    const { controller, service } = makeController()
    const tariff = { id: 'tar-1' }
    service.getActive.mockResolvedValue(tariff)

    await expect(controller.getActive()).resolves.toBe(tariff)
  })

  it('list usa 20 versiones por defecto', async () => {
    const { controller, service } = makeController()
    service.listHistory.mockResolvedValue([])

    await controller.list({})

    expect(service.listHistory).toHaveBeenCalledWith(20)
  })

  it('list respeta el límite pedido y publica el DTO', async () => {
    const { controller, service } = makeController()
    service.listHistory.mockResolvedValue([])
    service.publish.mockResolvedValue({ id: 'tar-2' })

    await controller.list({ limit: 10 })
    const dto = { baseFare: 600, perKm: 250, perOrder: 350, createdBy: 'admin-1' }
    await controller.publish(dto)

    expect(service.listHistory).toHaveBeenCalledWith(10)
    expect(service.publish).toHaveBeenCalledWith(dto)
  })
})
