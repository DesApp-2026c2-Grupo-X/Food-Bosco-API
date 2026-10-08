import { ERROR_CODES } from '../config/constants'
import type { PromotionDocument, PublicPromotion } from './promotion.model'
import type { PromotionListQuery } from './promotion.repository'
import { PromotionRepository } from './promotion.repository'
import { PromotionService } from './promotion.service'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): PromotionDocument =>
  ({
    _id: { toString: () => 'prom1' },
    name: '2x1',
    description: 'Martes',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-02-01T00:00:00.000Z'),
    active: true,
    ...overrides,
  }) as unknown as PromotionDocument

const makeService = (repository: Partial<Record<string, jest.Mock>> = {}) => {
  const mock = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...repository,
  }
  return { repository: mock, service: new PromotionService(mock as unknown as PromotionRepository) }
}
describe('PromotionService.list (RQ-CAT-13)', () => {
  const query: PromotionListQuery = { limit: 20, offset: 0 }

  it('serializa las promociones y devuelve meta con total, limit y offset', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue({
        data: [buildDoc(), buildDoc({ _id: { toString: () => 'prom2' }, active: false })],
        total: 3,
      }),
    })

    const result = await service.list(query)

    expect(result.meta).toEqual({ total: 3, limit: 20, offset: 0 })
    expect(result.data).toEqual<PublicPromotion[]>([
      {
        id: 'prom1',
        name: '2x1',
        description: 'Martes',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        active: true,
      },
      {
        id: 'prom2',
        name: '2x1',
        description: 'Martes',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        active: false,
      },
    ])
  })

  it('propaga activeOnly y paginación al repositorio', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    })
    const filtered: PromotionListQuery = { activeOnly: true, limit: 5, offset: 10 }

    await service.list(filtered)

    expect(repository.list).toHaveBeenCalledWith(filtered)
  })

  it('devuelve lista vacía con total 0 cuando no hay coincidencias', async () => {
    const { service } = makeService({ list: jest.fn().mockResolvedValue({ data: [], total: 0 }) })

    await expect(service.list(query)).resolves.toEqual({
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    })
  })
})

describe('PromotionService.findById', () => {
  it('devuelve la promoción serializada si existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(buildDoc()) })

    const result = await service.findById('prom1')

    expect(result).toMatchObject({ id: 'prom1', name: '2x1', active: true })
  })

  it('devuelve null si no existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(null) })

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})

describe('PromotionService.create (RQ-CAT-13)', () => {
  it('crea la promoción y devuelve la representación pública', async () => {
    const { repository, service } = makeService({
      create: jest.fn().mockResolvedValue(buildDoc({ name: 'Verano' })),
    })
    const data = {
      name: 'Verano',
      description: 'Temporada',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
    }

    const result = await service.create(data)

    expect(repository.create).toHaveBeenCalledWith(data)
    expect(result.name).toBe('Verano')
  })
})

describe('PromotionService.create — validación de rango de fechas (RQ-CAT-13)', () => {
  const makeCreate = () =>
    makeService({ create: jest.fn().mockImplementation((data: object) => buildDoc(data)) })

  it.each([
    {
      name: 'rango válido (inicio anterior al fin)',
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-02-01T00:00:00.000Z'),
      valid: true,
    },
    {
      name: 'límite (inicio igual al fin)',
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-01T00:00:00.000Z'),
      valid: true,
    },
    {
      name: 'inválido (inicio posterior al fin)',
      start: new Date('2026-03-01T00:00:00.000Z'),
      end: new Date('2026-02-01T00:00:00.000Z'),
      valid: false,
    },
  ])('$name → $valid', async ({ start, end, valid }) => {
    const { repository, service } = makeCreate()

    const promise = service.create({ name: 'Fechas', startDate: start, endDate: end })

    if (valid) {
      await expect(promise).resolves.toBeDefined()
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: start, endDate: end }),
      )
    } else {
      await expect(promise).rejects.toMatchObject({
        code: ERROR_CODES.validationError,
        status: 400,
      })
      expect(repository.create).not.toHaveBeenCalled()
    }
  })
})

describe('PromotionService.update — validación de rango de fechas (RQ-CAT-13)', () => {
  it('valida el rango efectivo al combinar el patch con la promoción existente', async () => {
    const current = buildDoc({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
    })
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue(current),
    })

    await expect(
      service.update('prom1', { startDate: new Date('2026-03-01T00:00:00.000Z') }),
    ).rejects.toMatchObject({ code: ERROR_CODES.validationError, status: 400 })
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('permite un patch de fechas coherente con la existente', async () => {
    const current = buildDoc({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
    })
    const updated = buildDoc({ endDate: new Date('2026-04-01T00:00:00.000Z') })
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue(updated),
    })

    const result = await service.update('prom1', { endDate: new Date('2026-04-01T00:00:00.000Z') })

    expect(result).toBeDefined()
    expect(repository.update).toHaveBeenCalled()
  })

  it('devuelve null sin validar si la promoción no existe', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    })

    await expect(
      service.update('missing', { startDate: new Date('2026-03-01T00:00:00.000Z') }),
    ).resolves.toBeNull()
    expect(repository.update).not.toHaveBeenCalled()
  })
})

describe('PromotionService.update', () => {
  it('actualiza y serializa cuando la promoción existe', async () => {
    const { repository, service } = makeService({
      update: jest.fn().mockResolvedValue(buildDoc({ name: 'Actualizada' })),
    })

    const result = await service.update('prom1', { name: 'Actualizada' })

    expect(repository.update).toHaveBeenCalledWith('prom1', { name: 'Actualizada' })
    expect(result?.name).toBe('Actualizada')
  })

  it('devuelve null si la promoción a actualizar no existe', async () => {
    const { service } = makeService({ update: jest.fn().mockResolvedValue(null) })

    await expect(service.update('missing', { name: 'X' })).resolves.toBeNull()
  })
})

describe('PromotionService.setActive', () => {
  it.each([
    { name: 'activa', active: true },
    { name: 'desactiva', active: false },
  ])('$name la promoción y devuelve el estado', async ({ active }) => {
    const { repository, service } = makeService({
      setActive: jest.fn().mockResolvedValue(buildDoc({ active })),
    })

    const result = await service.setActive('prom1', active)

    expect(repository.setActive).toHaveBeenCalledWith('prom1', active)
    expect(result?.active).toBe(active)
  })

  it('devuelve null si la promoción no existe', async () => {
    const { service } = makeService({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(service.setActive('missing', false)).resolves.toBeNull()
  })
})
