import { PARAMETER_KEYS } from '../config/constants'
import { haversineDistanceKm } from '../config/geo/distance'
import type { ParameterService } from '../parameter/parameter.service'
import type { BranchDocument, BranchHours } from './branch.model'
import type { BranchListQuery, BranchRepository } from './branch.repository'
import { BranchService } from './branch.service'

const NOW = new Date(2026, 7, 24, 12, 0, 0)
const DAY = NOW.getDay()

const hourFor = (dayOfWeek: number, overrides: Partial<BranchHours> = {}): BranchHours =>
  ({
    dayOfWeek,
    opening: '08:00',
    closing: '20:00',
    closed: false,
    ...overrides,
  }) as BranchHours

const openHours = [hourFor(DAY)]

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): BranchDocument =>
  ({
    _id: { toString: () => 'b1' },
    name: 'Centro',
    addressText: 'Av 1',
    latitude: 0,
    longitude: 0,
    phone: null,
    active: true,
    hours: openHours,
    ...overrides,
  }) as unknown as BranchDocument

const makeService = (repository: Partial<BranchRepository> = {}, maxDistanceKm = 5) => {
  const repo = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    updateHours: jest.fn(),
    findActive: jest.fn(),
    listAvailability: jest.fn(),
    upsertAvailability: jest.fn(),
    ...repository,
  }
  const parameterService = { getValue: jest.fn().mockResolvedValue(maxDistanceKm) }
  const service = new BranchService(
    repo as unknown as BranchRepository,
    parameterService as unknown as ParameterService,
  )
  return { service, repo, parameterService }
}

const branchAt = (id: string, latitude: number, hours: BranchHours[] = openHours): BranchDocument =>
  buildDoc({ _id: { toString: () => id }, latitude, longitude: 0, hours })

describe('BranchService.list (RQ-BRN-01)', () => {
  it('lista, serializa y arma la paginación con el query recibido', async () => {
    const docs = [buildDoc(), buildDoc({ _id: { toString: () => 'b2' }, name: 'Norte' })]
    const { service, repo } = makeService({
      list: jest.fn().mockResolvedValue({ data: docs, total: 2 }),
    })
    const query: BranchListQuery = { active: true, search: 'cen', limit: 10, offset: 5 }

    const result = await service.list(query)

    expect(repo.list).toHaveBeenCalledWith(query)
    expect(result.meta).toEqual({ total: 2, limit: 10, offset: 5 })
    expect(result.data.map((branch) => branch.id)).toEqual(['b1', 'b2'])
  })

  it.each([
    { name: 'activas', active: true, expected: true },
    { name: 'inactivas', active: false, expected: false },
    { name: 'sin filtro de estado', active: undefined, expected: undefined },
  ])('propaga el filtro $name al repositorio', async ({ active, expected }) => {
    const { service, repo } = makeService({
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    })

    await service.list({ active, limit: 20, offset: 0 })

    expect(repo.list).toHaveBeenCalledWith({ active: expected, limit: 20, offset: 0 })
  })
})

describe('BranchService.findById (RQ-BRN-07)', () => {
  it.each([
    { name: 'encontrada', doc: buildDoc(), expected: true },
    { name: 'no encontrada', doc: null, expected: false },
  ])('$name → devuelve $expected', async ({ doc, expected }) => {
    const { service, repo } = makeService({ findById: jest.fn().mockResolvedValue(doc) })

    const result = await service.findById('b1')

    expect(repo.findById).toHaveBeenCalledWith('b1')
    if (expected) {
      expect(result).toMatchObject({ id: 'b1', name: 'Centro' })
    } else {
      expect(result).toBeNull()
    }
  })
})

describe('BranchService.create (RQ-BRN-01/02)', () => {
  it('delega en el repositorio y serializa la sucursal creada', async () => {
    const data = {
      name: 'Nueva',
      addressText: 'Calle 2',
      latitude: -34.6,
      longitude: -58.4,
      phone: '555',
      active: true,
    }
    const { service, repo } = makeService({
      create: jest.fn().mockResolvedValue(buildDoc({ name: 'Nueva', phone: '555' })),
    })

    const result = await service.create(data)

    expect(repo.create).toHaveBeenCalledWith(data)
    expect(result).toMatchObject({ name: 'Nueva', phone: '555' })
  })
})

describe('BranchService.update (RQ-BRN-01)', () => {
  it('actualiza y serializa la sucursal', async () => {
    const { service, repo } = makeService({
      update: jest.fn().mockResolvedValue(buildDoc({ name: 'Renombrada' })),
    })

    const result = await service.update('b1', { name: 'Renombrada' })

    expect(repo.update).toHaveBeenCalledWith('b1', { name: 'Renombrada' })
    expect(result?.name).toBe('Renombrada')
  })

  it('devuelve null si no existe (el controller responde BRANCH_NOT_FOUND)', async () => {
    const { service, repo } = makeService({ update: jest.fn().mockResolvedValue(null) })

    const result = await service.update('missing', { name: 'X' })

    expect(repo.update).toHaveBeenCalledWith('missing', { name: 'X' })
    expect(result).toBeNull()
  })
})

describe('BranchService.setActive (RQ-BRN-01)', () => {
  it.each([
    { name: 'activar', active: true },
    { name: 'desactivar', active: false },
  ])('$name una sucursal existente', async ({ active }) => {
    const { service, repo } = makeService({
      setActive: jest.fn().mockResolvedValue(buildDoc({ active })),
    })

    const result = await service.setActive('b1', active)

    expect(repo.setActive).toHaveBeenCalledWith('b1', active)
    expect(result?.active).toBe(active)
  })

  it('devuelve null si la sucursal no existe', async () => {
    const { service } = makeService({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(service.setActive('missing', false)).resolves.toBeNull()
  })
})

describe('BranchService.updateHours (RQ-BRN-03)', () => {
  it('reemplaza los horarios y los devuelve serializados', async () => {
    const hours = [hourFor(DAY, { opening: '09:00', closing: '18:00' })]
    const { service, repo } = makeService({
      updateHours: jest.fn().mockResolvedValue(buildDoc({ hours })),
    })

    const result = await service.updateHours('b1', hours)

    expect(repo.updateHours).toHaveBeenCalledWith('b1', hours)
    expect(result?.hours).toEqual(hours)
  })

  it('acepta una lista de horarios vacía', async () => {
    const { service, repo } = makeService({
      updateHours: jest.fn().mockResolvedValue(buildDoc({ hours: [] })),
    })

    const result = await service.updateHours('b1', [])

    expect(repo.updateHours).toHaveBeenCalledWith('b1', [])
    expect(result?.hours).toEqual([])
  })

  it('devuelve null si la sucursal no existe', async () => {
    const { service } = makeService({ updateHours: jest.fn().mockResolvedValue(null) })

    await expect(service.updateHours('missing', [])).resolves.toBeNull()
  })
})

describe('BranchService.findAvailable (RQ-BRN-04/05/06/08)', () => {
  const origin = { latitude: 0, longitude: 0 }

  beforeEach(() => jest.useFakeTimers({ now: NOW }))
  afterEach(() => jest.useRealTimers())

  it('sin sucursales activas → [] y lee la distancia máxima configurada', async () => {
    const { service, repo, parameterService } = makeService({
      findActive: jest.fn().mockResolvedValue([]),
    })

    const result = await service.findAvailable(origin.latitude, origin.longitude)

    expect(result).toEqual([])
    expect(parameterService.getValue).toHaveBeenCalledWith(PARAMETER_KEYS.maxDistanceKm)
    expect(repo.findActive).toHaveBeenCalledTimes(1)
    expect(repo.list).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'día marcado cerrado',
      hours: [hourFor(DAY, { closed: true })],
    },
    {
      name: 'sin horario para el día actual',
      hours: [hourFor((DAY + 1) % 7)],
    },
    {
      name: 'antes de la apertura',
      hours: [hourFor(DAY, { opening: '13:00', closing: '20:00' })],
    },
    {
      name: 'después del cierre',
      hours: [hourFor(DAY, { opening: '08:00', closing: '11:00' })],
    },
  ])('excluye la sucursal cerrada ($name)', async ({ hours }) => {
    const { service } = makeService({
      findActive: jest.fn().mockResolvedValue([branchAt('b1', 0, hours)]),
    })

    await expect(service.findAvailable(origin.latitude, origin.longitude)).resolves.toEqual([])
  })

  const distanceToHalfDegree = haversineDistanceKm(origin, { latitude: 0.5, longitude: 0 })

  it.each([
    {
      name: 'dentro del límite',
      maxDistanceKm: distanceToHalfDegree + 0.0001,
      expectedIds: ['b1'],
    },
    {
      name: 'exactamente en el límite (incluido)',
      maxDistanceKm: distanceToHalfDegree,
      expectedIds: ['b1'],
    },
    {
      name: 'por fuera del límite',
      maxDistanceKm: distanceToHalfDegree - 0.0001,
      expectedIds: [],
    },
  ])('$name → $expectedIds', async ({ maxDistanceKm, expectedIds }) => {
    const { service } = makeService(
      { findActive: jest.fn().mockResolvedValue([branchAt('b1', 0.5)]) },
      maxDistanceKm,
    )

    const result = await service.findAvailable(origin.latitude, origin.longitude)

    expect(result.map((branch) => branch.id)).toEqual(expectedIds)
  })

  it('exactamente en el origen con distancia máxima 0 → la incluye', async () => {
    const { service } = makeService(
      { findActive: jest.fn().mockResolvedValue([branchAt('b1', 0)]) },
      0,
    )

    const result = await service.findAvailable(origin.latitude, origin.longitude)

    expect(result.map((branch) => branch.id)).toEqual(['b1'])
  })

  it('ordena por distancia ascendente y omite las cerradas entre las abiertas', async () => {
    const branches = [
      branchAt('far', 0.5),
      branchAt('closed-near', 0.05, [hourFor(DAY, { closed: true })]),
      branchAt('mid', 0.3),
      branchAt('near', 0.1),
    ]
    const { service } = makeService(
      { findActive: jest.fn().mockResolvedValue(branches) },
      100,
    )

    const result = await service.findAvailable(origin.latitude, origin.longitude)

    expect(result.map((branch) => branch.id)).toEqual(['near', 'mid', 'far'])
  })
})

describe('BranchService.getAvailabilityMap (RQ-CAT-16)', () => {
  it.each([
    { name: 'sin registros', docs: [], expected: [] as Array<[string, boolean]> },
    {
      name: 'disponibles y pausados',
      docs: [
        { productId: 'p1', available: true },
        { productId: 'p2', available: false },
      ],
      expected: [
        ['p1', true],
        ['p2', false],
      ] as Array<[string, boolean]>,
    },
  ])('$name → mapa esperado', async ({ docs, expected }) => {
    const { service, repo } = makeService({
      listAvailability: jest.fn().mockResolvedValue(docs),
    })

    const result = await service.getAvailabilityMap('b1')

    expect(repo.listAvailability).toHaveBeenCalledWith('b1')
    expect([...result.entries()]).toEqual(expected)
  })
})

describe('BranchService.setProductAvailability (RQ-CAT-16)', () => {
  it.each([
    { name: 'pausar', available: false },
    { name: 'reactivar', available: true },
  ])('$name un producto en la sucursal', async ({ available }) => {
    const { service, repo } = makeService({
      upsertAvailability: jest.fn().mockResolvedValue(undefined),
    })

    await service.setProductAvailability('b1', 'p1', available)

    expect(repo.upsertAvailability).toHaveBeenCalledWith('b1', 'p1', available)
  })
})
