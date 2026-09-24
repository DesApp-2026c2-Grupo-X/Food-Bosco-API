import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateParameterDto, UpdateParameterDto } from './parameter.dto'

const updateErrors = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(UpdateParameterDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

const createErrors = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(CreateParameterDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('UpdateParameterDto (RQ-CFG-02)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'valor positivo', payload: { value: 10 } },
    { name: 'valor decimal', payload: { value: 0.5 } },
    { name: 'valor en el mínimo permitido (límite)', payload: { value: 0.0001 } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(updateErrors(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'valor cero', payload: { value: 0 } },
    { name: 'valor negativo', payload: { value: -1 } },
    { name: 'valor bajo el mínimo', payload: { value: 0.00001 } },
    { name: 'valor no numérico', payload: { value: 'diez' } },
    { name: 'sin valor', payload: {} },
  ]

  it.each(invalidCases)('$name → inválido en value', async ({ payload }) => {
    await expect(updateErrors(payload)).resolves.toContain('value')
  })
})

describe('CreateParameterDto (RQ-CFG-01/02)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'todos los campos válidos',
      payload: { key: 'MAX_DISTANCE_KM', value: 10, unit: 'km' },
    },
    {
      name: 'valor en el mínimo permitido (límite)',
      payload: { key: 'K', value: 0.0001, unit: 'u' },
    },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(createErrors(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'sin key', payload: { value: 10, unit: 'km' }, property: 'key' },
    { name: 'key vacía', payload: { key: '', value: 10, unit: 'km' }, property: 'key' },
    { name: 'sin unit', payload: { key: 'K', value: 10 }, property: 'unit' },
    { name: 'unit vacía', payload: { key: 'K', value: 10, unit: '' }, property: 'unit' },
    { name: 'valor cero', payload: { key: 'K', value: 0, unit: 'u' }, property: 'value' },
    { name: 'valor negativo', payload: { key: 'K', value: -5, unit: 'u' }, property: 'value' },
    { name: 'sin valor', payload: { key: 'K', unit: 'u' }, property: 'value' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(createErrors(payload)).resolves.toContain(property)
  })
})
