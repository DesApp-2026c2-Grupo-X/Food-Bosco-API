import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidatorOptions } from 'class-validator'
import { CreatePromotionDto } from './create-promotion.dto'
import { PromotionQueryDto } from './promotion-query.dto'
import { SetActiveDto } from './set-active.dto'
import { UpdatePromotionDto } from './update-promotion.dto'

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

const validRange = {
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-01T00:00:00.000Z',
}

describe('CreatePromotionDto (RQ-CAT-13)', () => {
  it.each([
    {
      name: 'nombre y fechas ISO válidas',
      payload: { name: '2x1', ...validRange },
      valid: true,
    },
    {
      name: 'con descripción',
      payload: { name: '2x1', description: 'Martes', ...validRange },
      valid: true,
    },
    {
      name: 'fechas con formato de sólo día',
      payload: { name: '2x1', startDate: '2026-01-01', endDate: '2026-02-01' },
      valid: true,
    },
    {
      name: 'descripción en el límite de 500',
      payload: { name: '2x1', description: 'd'.repeat(500), ...validRange },
      valid: true,
    },
    { name: 'sin nombre', payload: validRange, valid: false },
    { name: 'nombre vacío', payload: { name: '', ...validRange }, valid: false },
    {
      name: 'nombre de 101 caracteres',
      payload: { name: 'a'.repeat(101), ...validRange },
      valid: false,
    },
    { name: 'sin startDate', payload: { name: '2x1', endDate: validRange.endDate }, valid: false },
    {
      name: 'sin endDate',
      payload: { name: '2x1', startDate: validRange.startDate },
      valid: false,
    },
    {
      name: 'startDate no es fecha ISO',
      payload: { name: '2x1', startDate: 'ayer', endDate: validRange.endDate },
      valid: false,
    },
    {
      name: 'endDate no es fecha ISO',
      payload: { name: '2x1', startDate: validRange.startDate, endDate: '32/13/2026' },
      valid: false,
    },
    {
      name: 'descripción de 501 caracteres',
      payload: { name: '2x1', description: 'd'.repeat(501), ...validRange },
      valid: false,
    },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(CreatePromotionDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  // RQ-CAT-13 / COM-02: el DTO valida el orden de las fechas además del formato ISO,
  // para que un rango invertido se rechace en la validación (400) antes del servicio.
  it('rechaza startDate posterior a endDate', async () => {
    const { invalid } = await check(CreatePromotionDto, {
      name: 'Fechas',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-01-01T00:00:00.000Z',
    })

    expect(invalid).toContain('startDate')
  })

  it('acepta startDate igual a endDate', async () => {
    const { invalid } = await check(CreatePromotionDto, {
      name: 'Fechas',
      startDate: validRange.startDate,
      endDate: validRange.startDate,
    })

    expect(invalid).toEqual([])
  })

  it('con whitelist descarta active, que no forma parte del DTO', async () => {
    const { instance, invalid } = await check(
      CreatePromotionDto,
      { name: '2x1', active: false, ...validRange },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.active).toBeUndefined()
  })
})

describe('UpdatePromotionDto', () => {
  it.each([
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'sólo nombre', payload: { name: 'Nueva' }, valid: true },
    { name: 'sólo startDate', payload: { startDate: validRange.startDate }, valid: true },
    { name: 'sólo endDate', payload: { endDate: validRange.endDate }, valid: true },
    { name: 'sólo descripción', payload: { description: 'x' }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101) }, valid: false },
    { name: 'startDate inválida', payload: { startDate: 'nope' }, valid: false },
    { name: 'endDate inválida', payload: { endDate: 'nope' }, valid: false },
    {
      name: 'rango invertido con ambas fechas',
      payload: { startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-01-01T00:00:00.000Z' },
      valid: false,
    },
    {
      name: 'descripción de 501 caracteres',
      payload: { description: 'd'.repeat(501) },
      valid: false,
    },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdatePromotionDto, payload)
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

describe('PromotionQueryDto (RQ-CAT-13)', () => {
  it.each([
    { name: 'vacío', payload: {}, valid: true },
    { name: 'limit mínimo 1', payload: { limit: 1 }, valid: true },
    { name: 'limit máximo 100', payload: { limit: 100 }, valid: true },
    { name: 'offset 0', payload: { offset: 0 }, valid: true },
    { name: 'limit 0', payload: { limit: 0 }, valid: false },
    { name: 'limit 101', payload: { limit: 101 }, valid: false },
    { name: 'limit decimal', payload: { limit: 2.5 }, valid: false },
    { name: 'limit no numérico', payload: { limit: 'x' }, valid: false },
    { name: 'offset negativo', payload: { offset: -1 }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(PromotionQueryDto, payload)
    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit string a número por el decorador @Type', async () => {
    const { instance, invalid } = await check(PromotionQueryDto, { limit: '30' })

    expect(invalid).toEqual([])
    expect(instance.limit).toBe(30)
  })

  // INT-03/NEW-04: con `enableImplicitConversion` (config real del ValidationPipe) el tipo
  // union evita que 'false' se coaccione a true y que un valor inválido caiga a false.
  it.each([
    { name: '"true" se transforma a true', input: 'true', expected: true },
    { name: 'true se mantiene true', input: true, expected: true },
    {
      name: '"false" se transforma a false con coerción implícita activa',
      input: 'false',
      expected: false,
    },
    { name: 'false se mantiene false', input: false, expected: false },
  ])('activeOnly: $name', async ({ input, expected }) => {
    const instance = plainToInstance(
      PromotionQueryDto,
      { activeOnly: input },
      { enableImplicitConversion: true },
    )

    await expect(validate(instance)).resolves.toHaveLength(0)
    expect(instance.activeOnly).toBe(expected)
  })

  // RQ-CAT-05: un `activeOnly` que no sea booleano ni 'true'/'false' se rechaza en lugar
  // de coaccionarse silenciosamente a false.
  it.each([
    { name: 'texto arbitrario', input: 'garbage' },
    { name: 'numérico', input: 0 },
    { name: 'objeto', input: { value: true } },
  ])('rechaza activeOnly con valor inválido ($name)', async ({ input }) => {
    const instance = plainToInstance(
      PromotionQueryDto,
      { activeOnly: input },
      { enableImplicitConversion: true },
    )
    const errors = await validate(instance)

    expect(errors.map((error) => error.property)).toContain('activeOnly')
  })
})

// INT-03: con `enableImplicitConversion` (config real del ValidationPipe) un
// string/número en `active` de body se coaccionaba a `true` y pasaba
// `@IsBoolean`. Sólo `true`/`false` reales deben ser válidos.
describe('INT-03: SetActiveDto.active con coerción implícita activa', () => {
  it.each([true, false])('acepta el booleano real %s', async (value) => {
    const instance = plainToInstance(
      SetActiveDto,
      { active: value },
      { enableImplicitConversion: true },
    )

    await expect(validate(instance)).resolves.toHaveLength(0)
  })

  it.each(['false', 'true', 123, 'yes', 0])('rechaza el valor no booleano %p', async (value) => {
    const instance = plainToInstance(
      SetActiveDto,
      { active: value },
      { enableImplicitConversion: true },
    )
    const errors = await validate(instance)

    expect(errors.map((error) => error.property)).toContain('active')
  })
})
