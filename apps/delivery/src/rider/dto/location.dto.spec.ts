import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { LocationDto } from './location.dto'

const errorProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
  const dto = plainToInstance(LocationDto, payload)
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('LocationDto (RQ-DLV-02)', () => {
  const validCases: Array<{ name: string; payload: Record<string, unknown> }> = [
    { name: 'centro (0,0)', payload: { lat: 0, lng: 0 } },
    { name: 'latitud máxima / longitud máxima', payload: { lat: 90, lng: 180 } },
    { name: 'latitud mínima / longitud mínima', payload: { lat: -90, lng: -180 } },
    { name: 'Buenos Aires', payload: { lat: -34.6, lng: -58.4 } },
  ]

  it.each(validCases)('$name → válido', async ({ payload }) => {
    await expect(errorProperties(payload)).resolves.toEqual([])
  })

  const invalidCases: Array<{
    name: string
    payload: Record<string, unknown>
    property: string
  }> = [
    { name: 'latitud > 90', payload: { lat: 90.0001, lng: 0 }, property: 'lat' },
    { name: 'latitud < -90', payload: { lat: -90.0001, lng: 0 }, property: 'lat' },
    { name: 'longitud > 180', payload: { lat: 0, lng: 180.0001 }, property: 'lng' },
    { name: 'longitud < -180', payload: { lat: 0, lng: -180.0001 }, property: 'lng' },
    { name: 'latitud no numérica', payload: { lat: 'norte', lng: 0 }, property: 'lat' },
    { name: 'sin latitud', payload: { lng: 0 }, property: 'lat' },
    { name: 'sin longitud', payload: { lat: 0 }, property: 'lng' },
  ]

  it.each(invalidCases)('$name → inválido en $property', async ({ payload, property }) => {
    await expect(errorProperties(payload)).resolves.toContain(property)
  })
})
