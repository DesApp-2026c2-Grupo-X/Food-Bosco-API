import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateZoneDto, SetActiveDto } from './zone.dto'

const errorProperties = async (
  payload: Record<string, unknown>,
  metatype: new () => object = SetActiveDto,
): Promise<string[]> => {
  const dto = plainToInstance(metatype, payload, { enableImplicitConversion: true })
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('CreateZoneDto', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'zona completa',
      payload: { name: 'Centro', center: { latitude: -34.6, longitude: -58.4 }, radiusKm: 4 },
    },
  ]

  it.each(validCases)('$name → válida', async ({ payload }) => {
    await expect(errorProperties(payload, CreateZoneDto)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    {
      name: 'sin nombre',
      payload: { center: { latitude: -34.6, longitude: -58.4 }, radiusKm: 4 },
      property: 'name',
    },
    {
      name: 'nombre demasiado largo',
      payload: {
        name: 'a'.repeat(101),
        center: { latitude: -34.6, longitude: -58.4 },
        radiusKm: 4,
      },
      property: 'name',
    },
    {
      name: 'sin centro',
      payload: { name: 'Centro', radiusKm: 4 },
      property: 'center',
    },
    {
      name: 'latitud inválida',
      payload: { name: 'Centro', center: { latitude: 100, longitude: -58.4 }, radiusKm: 4 },
      property: 'center',
    },
    {
      name: 'longitud inválida',
      payload: { name: 'Centro', center: { latitude: -34.6, longitude: 200 }, radiusKm: 4 },
      property: 'center',
    },
    {
      name: 'radio cero',
      payload: { name: 'Centro', center: { latitude: -34.6, longitude: -58.4 }, radiusKm: 0 },
      property: 'radiusKm',
    },
    {
      name: 'radio negativo',
      payload: { name: 'Centro', center: { latitude: -34.6, longitude: -58.4 }, radiusKm: -1 },
      property: 'radiusKm',
    },
  ]

  it.each(invalidCases)('$name → inválida en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload, CreateZoneDto)).resolves.toContain(property)
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
