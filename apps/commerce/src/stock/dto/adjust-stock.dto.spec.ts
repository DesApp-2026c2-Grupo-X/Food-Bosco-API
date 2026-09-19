import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AdjustStockDto } from './adjust-stock.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(AdjustStockDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('AdjustStockDto (RQ-STK-04/10)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'delta positivo',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: 5 },
    },
    {
      name: 'delta negativo',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: -5 },
    },
    {
      name: 'delta cero (límite)',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: 0 },
    },
    {
      name: 'reason opcional informado',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: 1, reason: 'compra' },
    },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    {
      name: 'sin branchId',
      payload: { ingredientId: 'i1', delta: 1 },
      property: 'branchId',
    },
    {
      name: 'branchId vacío',
      payload: { branchId: '', ingredientId: 'i1', delta: 1 },
      property: 'branchId',
    },
    {
      name: 'sin ingredientId',
      payload: { branchId: 'b1', delta: 1 },
      property: 'ingredientId',
    },
    {
      name: 'delta no numérico',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: 'cinco' },
      property: 'delta',
    },
    {
      name: 'delta NaN',
      payload: { branchId: 'b1', ingredientId: 'i1', delta: Number.NaN },
      property: 'delta',
    },
    {
      name: 'sin delta',
      payload: { branchId: 'b1', ingredientId: 'i1' },
      property: 'delta',
    },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })
})
