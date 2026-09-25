import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AvailabilityDto } from './availability.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(AvailabilityDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('AvailabilityDto (RQ-DLV-01)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'online true', payload: { online: true } },
    { name: 'online false', payload: { online: false } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'campo ausente', payload: {}, property: 'online' },
    { name: 'null', payload: { online: null }, property: 'online' },
    { name: 'string "true"', payload: { online: 'true' }, property: 'online' },
    { name: 'número 1', payload: { online: 1 }, property: 'online' },
    { name: 'número 0', payload: { online: 0 }, property: 'online' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })
})
