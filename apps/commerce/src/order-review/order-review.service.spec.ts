import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { OrderReviewDocument } from './order-review.model'
import { OrderReviewService } from './order-review.service'
import type { OrderReviewRepository } from './order-review.repository'

const reviewDoc = (overrides: Partial<Record<string, unknown>> = {}): OrderReviewDocument =>
  ({
    _id: { toString: () => 'r1' },
    orderId: 'o1',
    customerId: 'c1',
    branchId: 'b1',
    branchRating: 5,
    branchComment: null,
    courierId: 'u-rider',
    courierRating: 4,
    courierComment: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as OrderReviewDocument

const makeService = (repository: Partial<OrderReviewRepository> = {}) => {
  const repo = {
    findByOrderId: jest.fn(),
    listByCustomer: jest.fn(),
    create: jest.fn(),
    branchStats: jest.fn(),
    courierStats: jest.fn(),
    branchRanking: jest.fn(),
    courierRanking: jest.fn(),
    summary: jest.fn(),
    ...repository,
  }
  const service = new OrderReviewService(repo as unknown as OrderReviewRepository)
  return { service, repo }
}

const baseData = {
  orderId: 'o1',
  customerId: 'c1',
  branchId: 'b1',
  branchRating: 5,
  branchComment: null,
  courierId: 'u-rider',
  courierRating: 4,
  courierComment: null,
}

const catchCode = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise
    return undefined
  } catch (error) {
    return error instanceof DomainException ? error.code : 'UNKNOWN'
  }
}

describe('OrderReviewService.create', () => {
  const ratingCases: Array<{ name: string; patch: Record<string, unknown>; code?: string }> = [
    { name: 'puntajes válidos en los límites', patch: { branchRating: 1, courierRating: 5 } },
    { name: 'puntaje de sucursal 0', patch: { branchRating: 0 }, code: ERROR_CODES.invalidReviewRating },
    { name: 'puntaje de sucursal 6', patch: { branchRating: 6 }, code: ERROR_CODES.invalidReviewRating },
    { name: 'puntaje decimal', patch: { branchRating: 3.5 }, code: ERROR_CODES.invalidReviewRating },
    { name: 'puntaje de repartidor 0', patch: { courierRating: 0 }, code: ERROR_CODES.invalidReviewRating },
    { name: 'puntaje de repartidor 6', patch: { courierRating: 6 }, code: ERROR_CODES.invalidReviewRating },
    {
      name: 'comentario de 501 caracteres',
      patch: { branchComment: 'a'.repeat(501) },
      code: ERROR_CODES.validationError,
    },
  ]

  it.each(ratingCases)('$name → $code', async ({ patch, code }) => {
    const { service, repo } = makeService({ create: jest.fn().mockResolvedValue(reviewDoc(patch)) })
    const result = await catchCode(service.create({ ...baseData, ...patch }))
    expect(result).toBe(code)
    expect(repo.create).toHaveBeenCalledTimes(code ? 0 : 1)
  })

  it('normaliza comentarios vacíos a null y recorta espacios', async () => {
    const { service, repo } = makeService({ create: jest.fn().mockResolvedValue(reviewDoc()) })
    await service.create({
      ...baseData,
      branchComment: '  Muy bueno  ',
      courierComment: '   ',
    })

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchComment: 'Muy bueno',
        courierComment: null,
      }),
    )
  })

  it('traduce el índice único duplicado a REVIEW_ALREADY_EXISTS', async () => {
    const duplicate = Object.assign(new Error('E11000'), { code: 11000 })
    const { service } = makeService({ create: jest.fn().mockRejectedValue(duplicate) })

    await expect(service.create(baseData)).rejects.toMatchObject({
      code: ERROR_CODES.reviewAlreadyExists,
    })
  })

  it('propaga errores de persistencia desconocidos', async () => {
    const failure = new Error('mongo caído')
    const { service } = makeService({ create: jest.fn().mockRejectedValue(failure) })

    await expect(service.create(baseData)).rejects.toBe(failure)
  })
})

describe('OrderReviewService consultas', () => {
  it('serializa la reseña encontrada', async () => {
    const { service } = makeService({ findByOrderId: jest.fn().mockResolvedValue(reviewDoc()) })

    const result = await service.findByOrderId('o1')

    expect(result).toMatchObject({ id: 'r1', orderId: 'o1', branchRating: 5, courierRating: 4 })
    expect(result?.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('devuelve null cuando el pedido no fue calificado', async () => {
    const { service } = makeService({ findByOrderId: jest.fn().mockResolvedValue(null) })
    await expect(service.findByOrderId('o1')).resolves.toBeNull()
  })

  it('delega estadísticas y rankings al repositorio', async () => {
    const { service, repo } = makeService({
      branchStats: jest.fn().mockResolvedValue('branch'),
      courierStats: jest.fn().mockResolvedValue('courier'),
      branchRanking: jest.fn().mockResolvedValue('branch-ranking'),
      courierRanking: jest.fn().mockResolvedValue('courier-ranking'),
      summary: jest.fn().mockResolvedValue('summary'),
    })

    await expect(service.branchStats('b1', { limit: 10 })).resolves.toBe('branch')
    await expect(service.courierStats('u1')).resolves.toBe('courier')
    await expect(service.branchRanking(5)).resolves.toBe('branch-ranking')
    await expect(service.courierRanking(5)).resolves.toBe('courier-ranking')
    await expect(service.summary()).resolves.toBe('summary')
    expect(repo.branchStats).toHaveBeenCalledWith('b1', { limit: 10 })
    expect(repo.courierStats).toHaveBeenCalledWith('u1', {})
    expect(repo.branchRanking).toHaveBeenCalledWith(5, {})
    expect(repo.courierRanking).toHaveBeenCalledWith(5, {})
  })
})
