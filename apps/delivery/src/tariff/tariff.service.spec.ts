import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import type { DeliveryTariff, DeliveryTariffDocument } from './tariff.model'
import { TariffRepository } from './tariff.repository'
import { TariffService } from './tariff.service'

type TariffOverrides = Partial<Omit<DeliveryTariff, 'id'>> & { _id?: { toString(): string } }

const buildDoc = (overrides: TariffOverrides = {}): DeliveryTariffDocument =>
  ({
    _id: { toString: () => 'tar-1' },
    baseFare: 500,
    perKm: 200,
    perOrder: 300,
    currency: 'ARS',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    active: true,
    createdBy: 'system:bootstrap',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as DeliveryTariffDocument

const makeService = () => {
  const repository = {
    findActive: jest.fn(),
    findHistory: jest.fn(),
    findById: jest.fn(),
    insertInactive: jest.fn(),
    deactivateAll: jest.fn().mockResolvedValue(0),
    activateById: jest.fn(),
    countActive: jest.fn().mockResolvedValue(0),
  }
  const service = new TariffService(repository as unknown as TariffRepository)
  return { service, repository }
}

const errorCodeOf = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return undefined
  const response = (error as Error & { getResponse?: () => { code?: string } }).getResponse?.()
  return response?.code
}

describe('TariffService.getActive (RQ-DLV-08)', () => {
  it('devuelve la tarifa activa serializada', async () => {
    const { service, repository } = makeService()
    repository.findActive.mockResolvedValue(buildDoc())

    const result = await service.getActive()

    expect(result).toEqual({
      id: 'tar-1',
      baseFare: 500,
      perKm: 200,
      perOrder: 300,
      currency: 'ARS',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      active: true,
      createdBy: 'system:bootstrap',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('lanza TARIFF_NOT_AVAILABLE cuando no hay tarifa vigente ni bootstrap posible', async () => {
    const { service, repository } = makeService()
    repository.findActive.mockResolvedValue(null)
    repository.insertInactive.mockResolvedValue(buildDoc({ active: false }))
    repository.activateById.mockResolvedValue(buildDoc({ active: false }))

    const error = await service.getActive().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect(errorCodeOf(error)).toBe(ERROR_CODES.tariffNotAvailable)
  })
})

describe('TariffService.listHistory', () => {
  it('usa el límite indicado y ordena lo que devuelve el repositorio', async () => {
    const { service, repository } = makeService()
    repository.findHistory.mockResolvedValue([
      buildDoc({ _id: { toString: () => 'nueva' }, effectiveFrom: new Date('2026-02-01') }),
      buildDoc({
        _id: { toString: () => 'vieja' },
        effectiveFrom: new Date('2026-01-01'),
        active: false,
      }),
    ])

    const result = await service.listHistory(5)

    expect(repository.findHistory).toHaveBeenCalledWith(5)
    expect(result.map((tariff) => tariff.id)).toEqual(['nueva', 'vieja'])
  })
})

describe('TariffService.publish (RQ-DLV-08)', () => {
  it('inserta la versión nueva, desactiva la anterior y activa la publicada', async () => {
    const { service, repository } = makeService()
    const previous = buildDoc({ _id: { toString: () => 'vieja' } })
    const created = buildDoc({ _id: { toString: () => 'nueva' }, active: false })
    const activated = buildDoc({ _id: { toString: () => 'nueva' }, active: true })

    repository.findActive.mockResolvedValue(previous)
    repository.insertInactive.mockResolvedValue(created)
    repository.activateById.mockResolvedValue(activated)

    const result = await service.publish({
      baseFare: 600,
      perKm: 250,
      perOrder: 400,
      currency: 'ars',
      createdBy: 'admin-1',
    })

    expect(repository.insertInactive).toHaveBeenCalledWith({
      baseFare: 600,
      perKm: 250,
      perOrder: 400,
      currency: 'ARS',
      createdBy: 'admin-1',
      effectiveFrom: expect.any(Date),
    })
    expect(repository.deactivateAll).toHaveBeenCalledTimes(1)
    expect(repository.activateById).toHaveBeenCalledWith('nueva')
    expect(result.active).toBe(true)
    expect(result.id).toBe('nueva')
  })

  it.each([
    { name: 'baseFare negativo', input: { baseFare: -1, perKm: 1, perOrder: 1 } },
    { name: 'perKm no finito', input: { baseFare: 1, perKm: Number.NaN, perOrder: 1 } },
    { name: 'perOrder negativo', input: { baseFare: 1, perKm: 1, perOrder: -0.01 } },
  ])('rechaza $name sin tocar la base', async ({ input }) => {
    const { service, repository } = makeService()

    const error = await service
      .publish({ ...input, createdBy: 'admin-1' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(BadRequestException)
    expect(errorCodeOf(error)).toBe(ERROR_CODES.validationError)
    expect(repository.insertInactive).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'moneda corta', currency: 'AR' },
    { name: 'moneda con números', currency: 'A1S' },
    { name: 'autor vacío', currency: 'ARS', createdBy: '   ' },
  ])('rechaza $name', async ({ currency, createdBy = 'admin-1' }) => {
    const { service, repository } = makeService()

    const error = await service
      .publish({ baseFare: 1, perKm: 1, perOrder: 1, currency, createdBy })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(BadRequestException)
    expect(repository.insertInactive).not.toHaveBeenCalled()
  })

  it('compensa reactivando la anterior y responde conflicto ante una publicación concurrente', async () => {
    const { service, repository } = makeService()
    const previous = buildDoc({ _id: { toString: () => 'vieja' }, active: true })
    const created = buildDoc({ _id: { toString: () => 'nueva' }, active: false })
    const duplicate = Object.assign(new Error('duplicate key'), { code: 11000 })

    repository.findActive.mockResolvedValue(previous)
    repository.insertInactive.mockResolvedValue(created)
    repository.activateById.mockImplementation(async (id: string) => {
      if (id === 'nueva') throw duplicate
      return buildDoc({ _id: { toString: () => id }, active: true })
    })

    const error = await service
      .publish({ baseFare: 1, perKm: 1, perOrder: 1, createdBy: 'admin-1' })
      .catch((caught: unknown) => caught)

    expect(repository.activateById).toHaveBeenNthCalledWith(1, 'nueva')
    expect(repository.activateById).toHaveBeenNthCalledWith(2, 'vieja')
    expect(error).toBeInstanceOf(ConflictException)
    expect(errorCodeOf(error)).toBe(ERROR_CODES.tariffConflict)
  })
})

describe('TariffService.ensureBootstrap (RQ-DLV-08)', () => {
  it('crea la tarifa inicial desde el seed con autor system:bootstrap', async () => {
    const { service, repository } = makeService()
    const created = buildDoc({ _id: { toString: () => 'seed' }, active: false })

    repository.countActive.mockResolvedValue(0)
    repository.insertInactive.mockResolvedValue(created)
    repository.activateById.mockResolvedValue(buildDoc({ _id: { toString: () => 'seed' } }))

    await service.ensureBootstrap()

    expect(repository.insertInactive).toHaveBeenCalledWith({
      baseFare: 500,
      perKm: 200,
      perOrder: 300,
      currency: 'ARS',
      createdBy: 'system:bootstrap',
      effectiveFrom: expect.any(Date),
    })
    expect(repository.deactivateAll).toHaveBeenCalledTimes(1)
    expect(repository.activateById).toHaveBeenCalledWith('seed')
  })

  it('es idempotente: no crea otra tarifa si ya hay una activa', async () => {
    const { service, repository } = makeService()
    repository.countActive.mockResolvedValue(1)

    await service.ensureBootstrap()
    await service.ensureBootstrap()

    expect(repository.insertInactive).not.toHaveBeenCalled()
    expect(repository.deactivateAll).not.toHaveBeenCalled()
  })

  it('comparte el bootstrap entre llamadas concurrentes', async () => {
    const { service, repository } = makeService()
    const created = buildDoc({ _id: { toString: () => 'seed' }, active: false })

    repository.countActive.mockResolvedValue(0)
    repository.insertInactive.mockResolvedValue(created)
    repository.activateById.mockResolvedValue(buildDoc({ _id: { toString: () => 'seed' } }))

    await Promise.all([service.ensureBootstrap(), service.ensureBootstrap()])

    expect(repository.insertInactive).toHaveBeenCalledTimes(1)
  })

  it('ignora el E11000 si otra instancia creó la tarifa al mismo tiempo', async () => {
    const { service, repository } = makeService()
    const duplicate = Object.assign(new Error('duplicate key'), { code: 11000 })

    repository.countActive.mockResolvedValue(0)
    repository.insertInactive.mockRejectedValue(duplicate)

    await expect(service.ensureBootstrap()).resolves.toBeUndefined()
    expect(repository.activateById).not.toHaveBeenCalled()
  })
})
