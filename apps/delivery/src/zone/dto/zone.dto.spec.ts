import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SetActiveDto } from './zone.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(SetActiveDto, payload, { enableImplicitConversion: true })
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('SetActiveDto (INT-03)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'active true', payload: { active: true } },
    { name: 'active false', payload: { active: false } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'string "false"', payload: { active: 'false' } },
    { name: 'string "true"', payload: { active: 'true' } },
    { name: 'número 123', payload: { active: 123 } },
    { name: 'número 1', payload: { active: 1 } },
    { name: 'número 0', payload: { active: 0 } },
    { name: 'null', payload: { active: null } },
    { name: 'campo ausente', payload: {} },
  ]

  it.each(invalidCases)('$name → inválido en active', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toContain('active')
  })
})
