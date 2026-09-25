import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { TripQueryDto } from './trip-query.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(TripQueryDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('TripQueryDto (RQ-DLV-10)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'sin parámetros (defaults)', payload: {} },
    { name: 'límite mínimo 1 / offset 0', payload: { limit: 1, offset: 0 } },
    { name: 'límite máximo 100', payload: { limit: 100, offset: 0 } },
    { name: 'paginación intermedia', payload: { limit: 50, offset: 10 } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'limit 0 (por debajo del mínimo)', payload: { limit: 0 }, property: 'limit' },
    { name: 'limit 101 (por encima del máximo)', payload: { limit: 101 }, property: 'limit' },
    { name: 'limit decimal', payload: { limit: 1.5 }, property: 'limit' },
    { name: 'offset negativo', payload: { offset: -1 }, property: 'offset' },
    { name: 'limit no numérico', payload: { limit: 'abc' }, property: 'limit' },
    { name: 'offset decimal', payload: { offset: 0.5 }, property: 'offset' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })

  it('convierte strings numéricos de query a number', () => {
    const dto = plainToInstance(TripQueryDto, { limit: '5', offset: '2' })

    expect(dto.limit).toBe(5)
    expect(dto.offset).toBe(2)
  })
})
