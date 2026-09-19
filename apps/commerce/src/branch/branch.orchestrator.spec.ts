import type { PublicProduct } from '../product/product.model'
import type { ProductService } from '../product/product.service'
import { BranchOrchestrator } from './branch.orchestrator'
import type { PublicBranch } from './branch.model'
import type { BranchService } from './branch.service'

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const branch = (id: string): PublicBranch => ({
  id,
  name: `Sucursal ${id}`,
  addressText: 'Av 1',
  latitude: 0,
  longitude: 0,
  phone: null,
  active: true,
  hours: [],
})

const makeOrchestrator = () => {
  const branchService = { getAvailabilityMap: jest.fn(), findAvailable: jest.fn() }
  const productService = { findAll: jest.fn() }
  const orchestrator = new BranchOrchestrator(
    branchService as unknown as BranchService,
    productService as unknown as ProductService,
  )
  return { orchestrator, branchService, productService }
}

describe('BranchOrchestrator.listProducts (RQ-CAT-16)', () => {
  it.each([
    { name: 'sin registro → disponible por defecto', map: new Map(), expected: true },
    { name: 'marcado disponible', map: new Map([['p1', true]]), expected: true },
    { name: 'pausado en la sucursal', map: new Map([['p1', false]]), expected: false },
  ])('$name', async ({ map, expected }) => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.getAvailabilityMap.mockResolvedValue(map)
    productService.findAll.mockResolvedValue([product()])

    const result = await orchestrator.listProducts('b1')

    expect(branchService.getAvailabilityMap).toHaveBeenCalledWith('b1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'p1',
      name: 'Hamburguesa',
      availableInBranch: expected,
    })
  })

  it('combina el flag de disponibilidad producto por producto', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.getAvailabilityMap.mockResolvedValue(new Map([['p2', false]]))
    productService.findAll.mockResolvedValue([product(), product({ id: 'p2', name: 'Papas' })])

    const result = await orchestrator.listProducts('b1')

    expect(result.data.map((item) => [item.id, item.availableInBranch])).toEqual([
      ['p1', true],
      ['p2', false],
    ])
  })
})

describe('BranchOrchestrator.listZoneProducts (RQ-BRN-08)', () => {
  it('usa la sucursal más cercana (primera) para combinar productos', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findAvailable.mockResolvedValue([branch('near'), branch('far')])
    branchService.getAvailabilityMap.mockResolvedValue(new Map())
    productService.findAll.mockResolvedValue([product()])

    const result = await orchestrator.listZoneProducts(-34.6, -58.4)

    expect(branchService.findAvailable).toHaveBeenCalledWith(-34.6, -58.4)
    expect(branchService.getAvailabilityMap).toHaveBeenCalledWith('near')
    expect(result.data).toHaveLength(1)
  })

  it('sin sucursal disponible → [] sin consultar productos', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findAvailable.mockResolvedValue([])

    const result = await orchestrator.listZoneProducts(0, 0)

    expect(result).toEqual({ data: [] })
    expect(productService.findAll).not.toHaveBeenCalled()
    expect(branchService.getAvailabilityMap).not.toHaveBeenCalled()
  })
})
