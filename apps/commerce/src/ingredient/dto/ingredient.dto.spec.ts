import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { CreateIngredientDto } from './create-ingredient.dto'
import { IngredientQueryDto } from './ingredient-query.dto'
import { SetActiveDto } from './set-active.dto'
import { UpdateIngredientDto } from './update-ingredient.dto'

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

describe('CreateIngredientDto (RQ-CAT-09)', () => {
  it.each([
    { name: 'nombre y unidad válidos', payload: { name: 'Papa', unit: 'kg' }, valid: true },
    {
      name: 'con active false',
      payload: { name: 'Papa', unit: 'kg', active: false },
      valid: true,
    },
    {
      name: 'nombre en el límite de 100 y unidad en 50',
      payload: { name: 'a'.repeat(100), unit: 'b'.repeat(50) },
      valid: true,
    },
    { name: 'sin nombre', payload: { unit: 'kg' }, valid: false },
    { name: 'nombre vacío', payload: { name: '', unit: 'kg' }, valid: false },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101), unit: 'kg' }, valid: false },
    { name: 'sin unidad', payload: { name: 'Papa' }, valid: false },
    { name: 'unidad vacía', payload: { name: 'Papa', unit: '' }, valid: false },
    { name: 'unidad de 51 caracteres', payload: { name: 'Papa', unit: 'u'.repeat(51) }, valid: false },
    { name: 'active no booleano', payload: { name: 'Papa', unit: 'kg', active: 'si' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateIngredientDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra', async () => {
    const { instance, invalid } = await check(
      CreateIngredientDto,
      { name: 'Papa', unit: 'kg', injected: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.injected).toBeUndefined()
  })
})

describe('UpdateIngredientDto', () => {
  it.each([
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'sólo nombre', payload: { name: 'Queso' }, valid: true },
    { name: 'sólo unidad', payload: { unit: 'g' }, valid: true },
    { name: 'sólo active', payload: { active: false }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101) }, valid: false },
    { name: 'unidad vacía', payload: { unit: '' }, valid: false },
    { name: 'unidad de 51 caracteres', payload: { unit: 'u'.repeat(51) }, valid: false },
    { name: 'active no booleano', payload: { active: 'no' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateIngredientDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('SetActiveDto', () => {
  it.each([
    { name: 'active true', payload: { active: true }, valid: true },
    { name: 'active false', payload: { active: false }, valid: true },
    { name: 'sin active', payload: {}, valid: false },
    { name: 'active string "true"', payload: { active: 'true' }, valid: false },
    { name: 'active numérico 1', payload: { active: 1 }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(SetActiveDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('IngredientQueryDto', () => {
  it.each([
    { name: 'vacío', payload: {}, valid: true },
    { name: 'limit mínimo 1', payload: { limit: 1 }, valid: true },
    { name: 'limit máximo 100', payload: { limit: 100 }, valid: true },
    { name: 'offset 0', payload: { offset: 0 }, valid: true },
    { name: 'search de 100 caracteres', payload: { search: 'a'.repeat(100) }, valid: true },
    { name: 'limit 0', payload: { limit: 0 }, valid: false },
    { name: 'limit 101', payload: { limit: 101 }, valid: false },
    { name: 'limit decimal', payload: { limit: 1.5 }, valid: false },
    { name: 'limit no numérico', payload: { limit: 'abc' }, valid: false },
    { name: 'offset negativo', payload: { offset: -1 }, valid: false },
    { name: 'search de 101 caracteres', payload: { search: 'a'.repeat(101) }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(IngredientQueryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit string a número por el decorador @Type', async () => {
    const { instance, invalid } = await check(IngredientQueryDto, { limit: '25' })

    expect(invalid).toEqual([])
    expect(instance.limit).toBe(25)
  })

  it.each([
    { name: '"true" se transforma a true', input: 'true', expected: true },
    { name: '"false" se transforma a false', input: 'false', expected: false },
    { name: 'un valor inesperado se coacciona a false', input: 'nope', expected: false },
  ])('activeOnly: $name', async ({ input, expected }) => {
    const { instance, invalid } = await check(IngredientQueryDto, { activeOnly: input })

    expect(invalid).toEqual([])
    expect(instance.activeOnly).toBe(expected)
  })
})
