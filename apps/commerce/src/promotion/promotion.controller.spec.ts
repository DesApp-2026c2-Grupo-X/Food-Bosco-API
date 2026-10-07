import { ERROR_CODES } from '../config/constants'
import { PromotionController } from './promotion.controller'
import type { PromotionListResponse } from './promotion.service'
import { PromotionService } from './promotion.service'

const emptyList: PromotionListResponse = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

const makeController = (
  overrides: Partial<
    Record<'list' | 'findById' | 'create' | 'update' | 'setActive', jest.Mock>
  > = {},
) => {
  const service = {
    list: jest.fn().mockResolvedValue(emptyList),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...overrides,
  }
  return { service, controller: new PromotionController(service as unknown as PromotionService) }
}

describe('PromotionController.list (RQ-CAT-13)', () => {
  it('aplica paginación por defecto limit 20 / offset 0', async () => {
    const { service, controller } = makeController()

    await controller.list({})

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0, activeOnly: undefined }),
    )
  })

  it('propaga activeOnly, limit y offset explícitos', async () => {
    const { service, controller } = makeController()

    await controller.list({ activeOnly: true, limit: 5, offset: 3 })

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true, limit: 5, offset: 3 }),
    )
  })
})

describe('PromotionController.create (RQ-CAT-13)', () => {
  it('convierte las fechas ISO string a Date antes de llamar al servicio', async () => {
    const { service, controller } = makeController({
      create: jest.fn().mockResolvedValue({ id: 'prom1' }),
    })

    await controller.create({
      name: 'Verano',
      description: 'Temporada',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
    })

    expect(service.create).toHaveBeenCalledWith({
      name: 'Verano',
      description: 'Temporada',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
    })
  })
})

describe('PromotionController.get — error de dominio', () => {
  it('devuelve la promoción cuando existe', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue({ id: 'prom1', name: '2x1' }),
    })

    await expect(controller.get('prom1')).resolves.toMatchObject({ id: 'prom1' })
  })

  it('lanza PROMOTION_NOT_FOUND 404 con mensaje cuando no existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.get('missing')).rejects.toMatchObject({
      code: ERROR_CODES.promotionNotFound,
      message: 'Promoción no encontrada',
      status: 404,
    })
  })
})

describe('PromotionController.update — error de dominio y fechas', () => {
  it('lanza PROMOTION_NOT_FOUND 404 al actualizar un id inexistente', async () => {
    const { controller } = makeController({ update: jest.fn().mockResolvedValue(null) })

    await expect(controller.update('missing', { name: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.promotionNotFound,
      message: 'Promoción no encontrada',
      status: 404,
    })
  })

  it('convierte sólo las fechas presentes y deja undefined las ausentes', async () => {
    const { service, controller } = makeController({
      update: jest.fn().mockResolvedValue({ id: 'prom1' }),
    })

    await controller.update('prom1', { name: 'Nueva', endDate: '2026-03-01T00:00:00.000Z' })

    expect(service.update).toHaveBeenCalledWith('prom1', {
      name: 'Nueva',
      description: undefined,
      startDate: undefined,
      endDate: new Date('2026-03-01T00:00:00.000Z'),
    })
  })
})

describe('PromotionController.setActive — error de dominio', () => {
  it('lanza PROMOTION_NOT_FOUND 404 al activar/desactivar un id inexistente', async () => {
    const { controller } = makeController({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(controller.setActive('missing', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.promotionNotFound,
      message: 'Promoción no encontrada',
      status: 404,
    })
  })

  it('pasa el nuevo estado al servicio', async () => {
    const { service, controller } = makeController({
      setActive: jest.fn().mockResolvedValue({ id: 'prom1' }),
    })

    await controller.setActive('prom1', { active: false })

    expect(service.setActive).toHaveBeenCalledWith('prom1', false)
  })
})
