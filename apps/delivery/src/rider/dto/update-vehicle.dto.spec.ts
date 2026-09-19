import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateVehicleDto } from './update-vehicle.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(UpdateVehicleDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('UpdateVehicleDto (RQ-DLV-11)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'solo tipo moto', payload: { type: 'moto' } },
    { name: 'solo tipo bici', payload: { type: 'bici' } },
    {
      name: 'todos los campos',
      payload: { type: 'moto', brand: 'Honda', model: 'Wave', plate: 'AB123CD' },
    },
    { name: 'marca en el límite (50)', payload: { type: 'moto', brand: 'b'.repeat(50) } },
    { name: 'patente en el límite (20)', payload: { type: 'bici', plate: 'p'.repeat(20) } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'sin tipo', payload: { brand: 'Honda' }, property: 'type' },
    { name: 'tipo desconocido', payload: { type: 'avion' }, property: 'type' },
    { name: 'tipo null', payload: { type: null }, property: 'type' },
    {
      name: 'marca de 51 caracteres',
      payload: { type: 'moto', brand: 'b'.repeat(51) },
      property: 'brand',
    },
    {
      name: 'modelo de 51 caracteres',
      payload: { type: 'moto', model: 'm'.repeat(51) },
      property: 'model',
    },
    {
      name: 'patente de 21 caracteres',
      payload: { type: 'moto', plate: 'p'.repeat(21) },
      property: 'plate',
    },
    { name: 'marca numérica', payload: { type: 'moto', brand: 123 }, property: 'brand' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })
})
