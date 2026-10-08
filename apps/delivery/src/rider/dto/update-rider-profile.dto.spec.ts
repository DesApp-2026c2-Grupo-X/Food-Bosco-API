import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateRiderProfileDto } from './update-rider-profile.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(UpdateRiderProfileDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('UpdateRiderProfileDto (RQ-DLV-11)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'solo teléfono', payload: { phone: '11223344' } },
    { name: 'body vacío (ambos opcionales)', payload: {} },
    { name: 'teléfono de 50 caracteres (límite)', payload: { phone: '1'.repeat(50) } },
    {
      name: 'nombre y apellido',
      payload: { firstName: 'Nuevo', lastName: 'Cambiado' },
    },
    { name: 'nombre de 50 caracteres (límite)', payload: { firstName: 'a'.repeat(50) } },
    {
      name: 'nombre, apellido y teléfono juntos',
      payload: { firstName: 'Ana', lastName: 'Gomez', phone: '11223344' },
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
    { name: 'teléfono vacío', payload: { phone: '' }, property: 'phone' },
    { name: 'teléfono de 51 caracteres', payload: { phone: '1'.repeat(51) }, property: 'phone' },
    { name: 'teléfono numérico', payload: { phone: 11223344 }, property: 'phone' },
    { name: 'teléfono objeto', payload: { phone: { value: '1' } }, property: 'phone' },
    { name: 'teléfono null (requerido si se envía)', payload: { phone: null }, property: 'phone' },
    { name: 'nombre vacío', payload: { firstName: '' }, property: 'firstName' },
    {
      name: 'nombre de 51 caracteres',
      payload: { firstName: 'a'.repeat(51) },
      property: 'firstName',
    },
    { name: 'nombre numérico', payload: { firstName: 123 }, property: 'firstName' },
    { name: 'nombre null', payload: { firstName: null }, property: 'firstName' },
    { name: 'apellido vacío', payload: { lastName: '' }, property: 'lastName' },
    {
      name: 'apellido de 51 caracteres',
      payload: { lastName: 'a'.repeat(51) },
      property: 'lastName',
    },
    { name: 'apellido numérico', payload: { lastName: 123 }, property: 'lastName' },
    { name: 'apellido null', payload: { lastName: null }, property: 'lastName' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })
})
