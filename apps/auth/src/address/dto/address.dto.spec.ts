import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { CreateAddressDto } from './create-address.dto'
import { UpdateAddressDto } from './update-address.dto'

type DtoClass = new () => object

const check = async (
  cls: DtoClass,
  payload: Record<string, unknown>,
  options: ValidatorOptions = {},
): Promise<{ instance: Record<string, unknown>; invalid: string[] }> => {
  const instance = plainToInstance(cls, payload)
  const errors = await validate(instance, options)
  return {
    instance: instance as unknown as Record<string, unknown>,
    invalid: errors.map((error) => error.property),
  }
}

const base = {
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
}

describe('CreateAddressDto (RQ-AUTH-20/22)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload completo válido', payload: { ...base }, valid: true },
    { name: 'solo campos obligatorios (sin ciudad ni cp)', payload: { label: 'Casa', text: 'Calle 1', latitude: 0, longitude: 0 }, valid: true },
    { name: 'label de 100 caracteres (límite)', payload: { ...base, label: 'a'.repeat(100) }, valid: true },
    { name: 'text de 300 caracteres (límite)', payload: { ...base, text: 'a'.repeat(300) }, valid: true },
    { name: 'city de 100 caracteres (límite)', payload: { ...base, city: 'a'.repeat(100) }, valid: true },
    { name: 'postalCode de 20 caracteres (límite)', payload: { ...base, postalCode: 'a'.repeat(20) }, valid: true },
    { name: 'sin label', payload: { ...base, label: undefined }, valid: false },
    { name: 'label vacío', payload: { ...base, label: '' }, valid: false },
    { name: 'label de 101 caracteres', payload: { ...base, label: 'a'.repeat(101) }, valid: false },
    { name: 'label numérico', payload: { ...base, label: 123 }, valid: false },
    { name: 'sin text', payload: { ...base, text: undefined }, valid: false },
    { name: 'text vacío', payload: { ...base, text: '' }, valid: false },
    { name: 'text de 301 caracteres', payload: { ...base, text: 'a'.repeat(301) }, valid: false },
    { name: 'city de 101 caracteres', payload: { ...base, city: 'a'.repeat(101) }, valid: false },
    { name: 'postalCode de 21 caracteres', payload: { ...base, postalCode: 'a'.repeat(21) }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateAddressDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it.each<{ name: string; latitude: unknown; valid: boolean }>([
    { name: 'latitud -90 (mínimo)', latitude: -90, valid: true },
    { name: 'latitud 90 (máximo)', latitude: 90, valid: true },
    { name: 'latitud 0', latitude: 0, valid: true },
    { name: 'latitud -90.0001 (fuera de rango)', latitude: -90.0001, valid: false },
    { name: 'latitud 90.0001 (fuera de rango)', latitude: 90.0001, valid: false },
    { name: 'latitud no numérica', latitude: 'abc', valid: false },
    { name: 'latitud ausente', latitude: undefined, valid: false },
  ])('latitud: $name → válido=$valid', async ({ latitude, valid }) => {
    const { invalid } = await check(CreateAddressDto, { ...base, latitude })
    expect(invalid.includes('latitude')).toBe(!valid)
  })

  it.each<{ name: string; longitude: unknown; valid: boolean }>([
    { name: 'longitud -180 (mínimo)', longitude: -180, valid: true },
    { name: 'longitud 180 (máximo)', longitude: 180, valid: true },
    { name: 'longitud 0', longitude: 0, valid: true },
    { name: 'longitud -180.0001 (fuera de rango)', longitude: -180.0001, valid: false },
    { name: 'longitud 180.0001 (fuera de rango)', longitude: 180.0001, valid: false },
    { name: 'longitud no numérica', longitude: 'abc', valid: false },
    { name: 'longitud ausente', longitude: undefined, valid: false },
  ])('longitud: $name → válido=$valid', async ({ longitude, valid }) => {
    const { invalid } = await check(CreateAddressDto, { ...base, longitude })
    expect(invalid.includes('longitude')).toBe(!valid)
  })

  it('con whitelist descarta campos extra sin reportar error', async () => {
    const { instance, invalid } = await check(
      CreateAddressDto,
      { ...base, userId: 'otro', active: false },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.userId).toBeUndefined()
    expect(instance.active).toBeUndefined()
  })
})

describe('UpdateAddressDto (RQ-AUTH-20)', () => {
  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'solo label', payload: { label: 'Trabajo' }, valid: true },
    { name: 'solo coordenadas', payload: { latitude: 10, longitude: 20 }, valid: true },
    { name: 'label de 101 caracteres', payload: { label: 'a'.repeat(101) }, valid: false },
    { name: 'text de 301 caracteres', payload: { text: 'a'.repeat(301) }, valid: false },
    { name: 'city de 101 caracteres', payload: { city: 'a'.repeat(101) }, valid: false },
    { name: 'postalCode de 21 caracteres', payload: { postalCode: 'a'.repeat(21) }, valid: false },
    { name: 'label numérico', payload: { label: 123 }, valid: false },
  ])('$name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateAddressDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it.each<{ name: string; payload: Record<string, unknown>; valid: boolean }>([
    { name: 'latitud -90 (mínimo)', payload: { latitude: -90 }, valid: true },
    { name: 'latitud 90 (máximo)', payload: { latitude: 90 }, valid: true },
    { name: 'latitud 90.0001 (fuera de rango)', payload: { latitude: 90.0001 }, valid: false },
    { name: 'longitud -180 (mínimo)', payload: { longitude: -180 }, valid: true },
    { name: 'longitud 180 (máximo)', payload: { longitude: 180 }, valid: true },
    { name: 'longitud -180.0001 (fuera de rango)', payload: { longitude: -180.0001 }, valid: false },
  ])('coordenadas: $name → válido=$valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateAddressDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('acepta label vacío porque no tiene @IsNotEmpty', async () => {
    const { invalid } = await check(UpdateAddressDto, { label: '' })
    expect(invalid).toEqual([])
  })

  it('con whitelist descarta userId inyectado', async () => {
    const { instance, invalid } = await check(
      UpdateAddressDto,
      { label: 'Trabajo', userId: 'otro' },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.userId).toBeUndefined()
  })
})
