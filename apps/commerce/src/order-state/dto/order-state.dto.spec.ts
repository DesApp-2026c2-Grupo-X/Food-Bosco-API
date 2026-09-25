import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateOrderStateDto, SetActiveDto, UpdateOrderStateDto } from './order-state.dto'

const errorProperties = async (instance: object): Promise<string[]> => {
  const errors = await validate(instance)
  return errors.map((error) => error.property)
}

describe('CreateOrderStateDto (RQ-CFG-05/06)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'todos los campos válidos',
      payload: { code: 'PREPARING', name: 'Preparando', order: 3 },
    },
    {
      name: 'order en el mínimo permitido (límite)',
      payload: { code: 'PENDING', name: 'Pendiente', order: 0 },
    },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(plainToInstance(CreateOrderStateDto, payload))).resolves.toEqual(
      [],
    )
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'sin code', payload: { name: 'X', order: 1 }, property: 'code' },
    { name: 'code vacío', payload: { code: '', name: 'X', order: 1 }, property: 'code' },
    { name: 'code no string', payload: { code: 1, name: 'X', order: 1 }, property: 'code' },
    {
      name: 'code supera 50 caracteres',
      payload: { code: 'C'.repeat(51), name: 'X', order: 1 },
      property: 'code',
    },
    { name: 'sin name', payload: { code: 'P', order: 1 }, property: 'name' },
    { name: 'name vacío', payload: { code: 'P', name: '', order: 1 }, property: 'name' },
    {
      name: 'name supera 100 caracteres',
      payload: { code: 'P', name: 'N'.repeat(101), order: 1 },
      property: 'name',
    },
    { name: 'order negativo', payload: { code: 'P', name: 'X', order: -1 }, property: 'order' },
    { name: 'order decimal', payload: { code: 'P', name: 'X', order: 1.5 }, property: 'order' },
    { name: 'sin order', payload: { code: 'P', name: 'X' }, property: 'order' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(plainToInstance(CreateOrderStateDto, payload))).resolves.toContain(
      property,
    )
  })
})

describe('UpdateOrderStateDto (RQ-CFG-06)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'sin campos (todos opcionales)', payload: {} },
    { name: 'solo name', payload: { name: 'Nuevo' } },
    { name: 'solo order en el mínimo (límite)', payload: { order: 0 } },
    { name: 'name y order', payload: { name: 'Nuevo', order: 5 } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(plainToInstance(UpdateOrderStateDto, payload))).resolves.toEqual(
      [],
    )
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'name vacío', payload: { name: '' }, property: 'name' },
    {
      name: 'name supera 100 caracteres',
      payload: { name: 'N'.repeat(101) },
      property: 'name',
    },
    { name: 'order negativo', payload: { order: -1 }, property: 'order' },
    { name: 'order decimal', payload: { order: 2.5 }, property: 'order' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(plainToInstance(UpdateOrderStateDto, payload))).resolves.toContain(
      property,
    )
  })
})

describe('SetActiveDto (RQ-CFG-06)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'active true', payload: { active: true } },
    { name: 'active false', payload: { active: false } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(plainToInstance(SetActiveDto, payload))).resolves.toEqual([])
  })

  const invalidCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'active no booleano', payload: { active: 'yes' } },
    { name: 'active numérico', payload: { active: 1 } },
    { name: 'sin active', payload: {} },
  ]

  it.each(invalidCases)('$name → inválido en active', async ({ payload }) => {
    await expect(errorProperties(plainToInstance(SetActiveDto, payload))).resolves.toContain(
      'active',
    )
  })
})
