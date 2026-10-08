import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AvailabilityDto } from './availability.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(AvailabilityDto, payload, { enableImplicitConversion: true })
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('AvailabilityDto (RQ-DLV-01, INT-03)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'online true', payload: { online: true } },
    { name: 'online false', payload: { online: false } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'string "false"', payload: { online: 'false' } },
    { name: 'string "true"', payload: { online: 'true' } },
    { name: 'número 123', payload: { online: 123 } },
    { name: 'número 1', payload: { online: 1 } },
    { name: 'número 0', payload: { online: 0 } },
    { name: 'null', payload: { online: null } },
    { name: 'campo ausente', payload: {} },
  ]

  it.each(invalidCases)('$name → inválido en online', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toContain('online')
  })
})
