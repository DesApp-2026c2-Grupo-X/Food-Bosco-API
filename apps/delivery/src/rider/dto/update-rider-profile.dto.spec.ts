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
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })

  // KNOWN BUG: @IsOptional() también ignora null, por lo que `phone: null` pasa la validación
  // y el repositorio hace $set: { phone: null } sobre un campo `required`. Se documenta el
  // comportamiento actual hasta que el source lo corrija (ver reporte).
  it('phone null pasa la validación (KNOWN BUG)', async () => {
    await expect(errorProperties({ phone: null })).resolves.toEqual([])
  })
})
