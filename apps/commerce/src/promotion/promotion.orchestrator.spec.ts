import { ERROR_CODES, PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import { PromotionOrchestrator } from './promotion.orchestrator'
import { PromotionService } from './promotion.service'

const makeOrchestrator = () => {
  const promotionService = {
    create: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'promo-1', ...d })),
    update: jest.fn().mockImplementation((id, d) => Promise.resolve({ id, ...d })),
  }
  const categoryService = {
    findById: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Hamburguesas' }),
  }
  const productService = {
    findByIds: jest.fn().mockResolvedValue([{ id: 'prod-1', name: 'Burger' }]),
  }
  const branchService = {
    findById: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Centro' }),
  }

  const orchestrator = new PromotionOrchestrator(
    promotionService as unknown as PromotionService,
    categoryService as any,
    productService as any,
    branchService as any,
  )

  return { orchestrator, promotionService, categoryService, productService, branchService }
}

describe('PromotionOrchestrator', () => {
  it('crea una promoción normalizando payload cuando las referencias son válidas', async () => {
    const { orchestrator, promotionService } = makeOrchestrator()

    const payload = {
      name: 'Promo 1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      type: PROMOTION_TYPE.percentage,
      scope: PROMOTION_SCOPE.order,
      categoryIds: ['cat-1'], // Debe limpiarse al ser scope ORDER
      productIds: ['prod-1'], // Debe limpiarse al ser scope ORDER
    }

    const result = await orchestrator.create(payload)

    expect(promotionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Promo 1',
        categoryIds: [],
        productIds: [],
      }),
    )
    expect(result.id).toBe('promo-1')
  })

  it('lanza PROMOTION_REFERENCE_NOT_FOUND si una categoría no existe', async () => {
    const { orchestrator, categoryService } = makeOrchestrator()
    categoryService.findById.mockResolvedValue(null)

    await expect(
      orchestrator.create({
        name: 'Promo 2',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        type: PROMOTION_TYPE.percentage,
        scope: PROMOTION_SCOPE.category,
        categoryIds: ['cat-inexistente'],
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.promotionReferenceNotFound,
      status: 400,
    })
  })

  it('lanza PROMOTION_REFERENCE_NOT_FOUND si un producto no existe', async () => {
    const { orchestrator, productService } = makeOrchestrator()
    productService.findByIds.mockResolvedValue([]) // ninguno encontrado

    await expect(
      orchestrator.create({
        name: 'Promo 3',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        type: PROMOTION_TYPE.percentage,
        scope: PROMOTION_SCOPE.product,
        productIds: ['prod-inexistente'],
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.promotionReferenceNotFound,
      status: 400,
    })
  })

  it('lanza PROMOTION_REFERENCE_NOT_FOUND si una sucursal no existe', async () => {
    const { orchestrator, branchService } = makeOrchestrator()
    branchService.findById.mockResolvedValue(null)

    await expect(
      orchestrator.create({
        name: 'Promo 4',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        branchIds: ['branch-inexistente'],
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.promotionReferenceNotFound,
      status: 400,
    })
  })

  it('actualiza una promoción delegando al servicio tras validar referencias', async () => {
    const { orchestrator, promotionService } = makeOrchestrator()

    await orchestrator.update('promo-1', {
      name: 'Nuevo nombre',
      branchIds: ['branch-1'],
    })

    expect(promotionService.update).toHaveBeenCalledWith(
      'promo-1',
      expect.objectContaining({ name: 'Nuevo nombre', branchIds: ['branch-1'] }),
    )
  })
})
