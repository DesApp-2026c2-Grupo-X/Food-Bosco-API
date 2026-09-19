import type { CategoryDocument, PublicCategory } from './category.model'
import { serializeCategory } from './category.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): CategoryDocument =>
  ({
    _id: { toString: () => 'cat1' },
    name: 'Bebidas',
    active: true,
    ...overrides,
  }) as unknown as CategoryDocument

describe('serializeCategory', () => {
  it.each([
    { name: 'categoría activa', active: true },
    { name: 'categoría inactiva', active: false },
  ])('mapea $name a la representación pública', ({ active }) => {
    const result = serializeCategory(buildDoc({ active, name: 'Postres' }))

    expect(result).toEqual<PublicCategory>({ id: 'cat1', name: 'Postres', active })
  })

  it('usa el ObjectId como string en el campo id', () => {
    const result = serializeCategory(buildDoc({ _id: { toString: () => '507f1f77bcf86cd799439011' } }))

    expect(result.id).toBe('507f1f77bcf86cd799439011')
  })

  it('no expone campos internos del documento', () => {
    const result = serializeCategory(
      buildDoc({ createdAt: new Date(), updatedAt: new Date(), secret: 'x' }),
    )

    expect(Object.keys(result).sort()).toEqual(['active', 'id', 'name'])
  })
})
