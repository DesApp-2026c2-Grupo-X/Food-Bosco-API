import type { IngredientDocument, PublicIngredient } from './ingredient.model'
import { serializeIngredient } from './ingredient.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): IngredientDocument =>
  ({
    _id: { toString: () => 'ing1' },
    name: 'Papa',
    unit: 'kg',
    minQuantity: 10,
    active: true,
    ...overrides,
  }) as unknown as IngredientDocument

describe('serializeIngredient', () => {
  it.each([
    { name: 'ingrediente activo', active: true },
    { name: 'ingrediente inactivo', active: false },
  ])('mapea $name a la representación pública', ({ active }) => {
    const result = serializeIngredient(
      buildDoc({ active, name: 'Queso', unit: 'laminas', minQuantity: 5 }),
    )

    expect(result).toEqual<PublicIngredient>({
      id: 'ing1',
      name: 'Queso',
      unit: 'laminas',
      minQuantity: 5,
      active,
    })
  })

  it('usa 0 como fallback cuando minQuantity está ausente en documentos previos', () => {
    const result = serializeIngredient(buildDoc({ minQuantity: undefined }))

    expect(result.minQuantity).toBe(0)
  })

  it('usa el ObjectId como string en el campo id', () => {
    const result = serializeIngredient(
      buildDoc({ _id: { toString: () => '507f1f77bcf86cd799439011' } }),
    )

    expect(result.id).toBe('507f1f77bcf86cd799439011')
  })

  it('no expone campos internos del documento', () => {
    const result = serializeIngredient(buildDoc({ createdAt: new Date(), secret: 'x' }))

    expect(Object.keys(result).sort()).toEqual(['active', 'id', 'minQuantity', 'name', 'unit'])
  })
})
