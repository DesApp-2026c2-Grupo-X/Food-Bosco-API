import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { CategoryQueryDto } from './category-query.dto'
import { CreateCategoryDto } from './create-category.dto'
import { SetActiveDto } from './set-active.dto'
import { UpdateCategoryDto } from './update-category.dto'

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

describe('CreateCategoryDto (RQ-CAT-02)', () => {
  it.each([
    { name: 'nombre válido', payload: { name: 'Bebidas' }, valid: true },
    { name: 'nombre y active false', payload: { name: 'Bebidas', active: false }, valid: true },
    { name: 'nombre en el límite de 100', payload: { name: 'a'.repeat(100) }, valid: true },
    { name: 'sin nombre', payload: {}, valid: false },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101) }, valid: false },
    { name: 'nombre numérico', payload: { name: 123 }, valid: false },
    { name: 'active no booleano', payload: { name: 'Bebidas', active: 'yes' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreateCategoryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('con whitelist descarta campos extra y no reporta error', async () => {
    const { instance, invalid } = await check(
      CreateCategoryDto,
      { name: 'Bebidas', hacker: 'x', active: true },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.hacker).toBeUndefined()
    expect(instance.name).toBe('Bebidas')
  })
})

describe('UpdateCategoryDto (RQ-CAT-01)', () => {
  it.each([
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'sólo nombre', payload: { name: 'Postres' }, valid: true },
    { name: 'sólo active', payload: { active: true }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'nombre numérico', payload: { name: 123 }, valid: false },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101) }, valid: false },
    { name: 'active no booleano', payload: { active: 'no' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateCategoryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })
})

describe('SetActiveDto (RQ-CAT-01)', () => {
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

describe('CategoryQueryDto (RQ-CAT-05)', () => {
  it.each([
    { name: 'vacío usa defaults en el controller', payload: {}, valid: true },
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
    { name: 'search numérico', payload: { search: 10 }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(CategoryQueryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit string a número por el decorador @Type', async () => {
    const { instance, invalid } = await check(CategoryQueryDto, { limit: '5' })

    expect(invalid).toEqual([])
    expect(instance.limit).toBe(5)
  })

  it.each([
    { name: '"true" se transforma a true', input: 'true', expected: true },
    { name: '"false" se transforma a false', input: 'false', expected: false },
    { name: 'un valor inesperado se coacciona a false (transform sin validación)', input: 'yes', expected: false },
  ])('activeOnly: $name', async ({ input, expected }) => {
    const { instance, invalid } = await check(CategoryQueryDto, { activeOnly: input })

    expect(invalid).toEqual([])
    expect(instance.activeOnly).toBe(expected)
  })
})
