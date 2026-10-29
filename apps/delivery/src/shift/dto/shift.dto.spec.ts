import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateShiftDto, SetActiveDto } from './shift.dto'

const errorProperties = async (
  payload: Record<string, unknown>,
  metatype: new () => object = SetActiveDto,
): Promise<string[]> => {
  const dto = plainToInstance(metatype, payload, { enableImplicitConversion: true })
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('CreateShiftDto', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'turno completo', payload: { name: 'Mañana', startTime: '08:00', endTime: '13:00' } },
    { name: 'turno nocturno', payload: { name: 'Noche', startTime: '22:00', endTime: '06:00' } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload, CreateShiftDto)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    {
      name: 'sin nombre',
      payload: { startTime: '08:00', endTime: '13:00' },
      property: 'name',
    },
    {
      name: 'nombre demasiado largo',
      payload: { name: 'a'.repeat(101), startTime: '08:00', endTime: '13:00' },
      property: 'name',
    },
    {
      name: 'hora de inicio inválida',
      payload: { name: 'Mañana', startTime: '25:00', endTime: '13:00' },
      property: 'startTime',
    },
    {
      name: 'hora de fin inválida',
      payload: { name: 'Mañana', startTime: '08:00', endTime: '13:60' },
      property: 'endTime',
    },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload, CreateShiftDto)).resolves.toContain(property)
  })
})

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
