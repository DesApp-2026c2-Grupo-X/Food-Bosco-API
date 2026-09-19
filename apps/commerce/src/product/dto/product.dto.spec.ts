import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { ValidationError, ValidatorOptions } from 'class-validator'
import { CONFIG_GROUP_TYPE } from '../../config/constants'
import { CreateConfigGroupDto } from './create-config-group.dto'
import { CreateConfigOptionDto } from './create-config-option.dto'
import { CreateProductDto } from './create-product.dto'
import { ProductQueryDto } from './product-query.dto'
import { RecipeItemDto, RecipeOptionAdjustmentDto, SetRecipeDto } from './recipe-item.dto'
import { SetAvailableDto } from './set-available.dto'
import { UpdateConfigGroupDto } from './update-config-group.dto'
import { UpdateConfigOptionDto } from './update-config-option.dto'
import { UpdateProductDto } from './update-product.dto'

type DtoClass = new () => object

interface CheckResult {
  instance: Record<string, unknown>
  invalid: string[]
  errors: ValidationError[]
}

const check = async (
  cls: DtoClass,
  payload: Record<string, unknown>,
  options: ValidatorOptions = {},
): Promise<CheckResult> => {
  const instance = plainToInstance(cls, payload)
  const errors = await validate(instance, options)
  return {
    instance: instance as unknown as Record<string, unknown>,
    invalid: errors.map((error) => error.property),
    errors,
  }
}

const sorted = (values: string[]): string[] => [...values].sort()

const validProduct = {
  categoryId: 'cat1',
  name: 'Burger',
  description: 'Rica',
  price: 100,
}

describe('CreateProductDto (RQ-CAT-04)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean; failed?: string[] }> = [
    { name: 'producto válido', payload: validProduct, valid: true },
    { name: 'precio 0 (límite)', payload: { ...validProduct, price: 0 }, valid: true },
    { name: 'nombre de 100 caracteres (límite)', payload: { ...validProduct, name: 'a'.repeat(100) }, valid: true },
    { name: 'descripción de 500 caracteres (límite)', payload: { ...validProduct, description: 'a'.repeat(500) }, valid: true },
    { name: 'imagen y available opcionales', payload: { ...validProduct, image: 'https://cdn.test/p.png', available: false }, valid: true },
    { name: 'sin categoría', payload: { name: 'Burger', description: 'Rica', price: 1 }, valid: false, failed: ['categoryId'] },
    { name: 'sin nombre', payload: { categoryId: 'cat1', description: 'Rica', price: 1 }, valid: false, failed: ['name'] },
    { name: 'sin descripción', payload: { categoryId: 'cat1', name: 'Burger', price: 1 }, valid: false, failed: ['description'] },
    { name: 'sin precio', payload: { categoryId: 'cat1', name: 'Burger', description: 'Rica' }, valid: false, failed: ['price'] },
    { name: 'nombre vacío', payload: { ...validProduct, name: '' }, valid: false, failed: ['name'] },
    { name: 'nombre de 101 caracteres', payload: { ...validProduct, name: 'a'.repeat(101) }, valid: false, failed: ['name'] },
    { name: 'descripción vacía', payload: { ...validProduct, description: '' }, valid: false, failed: ['description'] },
    { name: 'descripción de 501 caracteres', payload: { ...validProduct, description: 'a'.repeat(501) }, valid: false, failed: ['description'] },
    { name: 'precio negativo', payload: { ...validProduct, price: -1 }, valid: false, failed: ['price'] },
    { name: 'precio string', payload: { ...validProduct, price: '100' }, valid: false, failed: ['price'] },
    { name: 'precio NaN', payload: { ...validProduct, price: Number.NaN }, valid: false, failed: ['price'] },
    { name: 'imagen de 501 caracteres', payload: { ...validProduct, image: 'a'.repeat(501) }, valid: false, failed: ['image'] },
    { name: 'available no booleano', payload: { ...validProduct, available: 'yes' }, valid: false, failed: ['available'] },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid, failed }) => {
    const { invalid } = await check(CreateProductDto, payload)

    expect(invalid.length === 0).toBe(valid)
    if (failed) {
      expect(sorted(invalid)).toEqual(sorted(failed))
    }
  })

  it('con whitelist descarta campos extra y no reporta error', async () => {
    const { instance, invalid } = await check(
      CreateProductDto,
      { ...validProduct, hacker: 'x' },
      { whitelist: true },
    )

    expect(invalid).toEqual([])
    expect(instance.hacker).toBeUndefined()
    expect(instance.name).toBe('Burger')
  })
})

describe('UpdateProductDto (RQ-CAT-03/04)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean; failed?: string[] }> = [
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'precio 0 (límite)', payload: { price: 0 }, valid: true },
    { name: 'solo nombre', payload: { name: 'Nuevo' }, valid: true },
    { name: 'solo available', payload: { available: false }, valid: true },
    { name: 'solo categoría', payload: { categoryId: 'cat2' }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false, failed: ['name'] },
    { name: 'precio negativo', payload: { price: -1 }, valid: false, failed: ['price'] },
    { name: 'precio string', payload: { price: '10' }, valid: false, failed: ['price'] },
    { name: 'available no booleano', payload: { available: 'no' }, valid: false, failed: ['available'] },
    { name: 'nombre de 101 caracteres', payload: { name: 'a'.repeat(101) }, valid: false, failed: ['name'] },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid, failed }) => {
    const { invalid } = await check(UpdateProductDto, payload)

    expect(invalid.length === 0).toBe(valid)
    if (failed) {
      expect(sorted(invalid)).toEqual(sorted(failed))
    }
  })
})

describe('SetAvailableDto (RQ-CAT-03)', () => {
  it.each([
    { name: 'available true', payload: { available: true }, valid: true },
    { name: 'available false', payload: { available: false }, valid: true },
    { name: 'sin available', payload: {}, valid: false },
    { name: 'available string "true"', payload: { available: 'true' }, valid: false },
    { name: 'available numérico 1', payload: { available: 1 }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(SetAvailableDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('CreateConfigGroupDto (RQ-CAT-07)', () => {
  const base = { name: 'Tamaño', type: CONFIG_GROUP_TYPE.single, required: true }

  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean; failed?: string[] }> = [
    { name: 'grupo single válido', payload: base, valid: true },
    { name: 'grupo multiple con min y max', payload: { ...base, type: CONFIG_GROUP_TYPE.multiple, required: false, min: 1, max: 3 }, valid: true },
    { name: 'min y max en 0 (límite)', payload: { ...base, min: 0, max: 0 }, valid: true },
    { name: 'sin nombre', payload: { type: CONFIG_GROUP_TYPE.single, required: true }, valid: false, failed: ['name'] },
    { name: 'nombre vacío', payload: { ...base, name: '' }, valid: false, failed: ['name'] },
    { name: 'nombre de 101 caracteres', payload: { ...base, name: 'a'.repeat(101) }, valid: false, failed: ['name'] },
    { name: 'tipo inválido', payload: { ...base, type: 'triple' }, valid: false, failed: ['type'] },
    { name: 'sin tipo', payload: { name: 'Tamaño', required: true }, valid: false, failed: ['type'] },
    { name: 'sin required', payload: { name: 'Tamaño', type: CONFIG_GROUP_TYPE.single }, valid: false, failed: ['required'] },
    { name: 'required no booleano', payload: { ...base, required: 'si' }, valid: false, failed: ['required'] },
    { name: 'min negativo', payload: { ...base, min: -1 }, valid: false, failed: ['min'] },
    { name: 'min decimal', payload: { ...base, min: 1.5 }, valid: false, failed: ['min'] },
    { name: 'max negativo', payload: { ...base, max: -1 }, valid: false, failed: ['max'] },
    { name: 'min string', payload: { ...base, min: '2' }, valid: false, failed: ['min'] },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid, failed }) => {
    const { invalid } = await check(CreateConfigGroupDto, payload)

    expect(invalid.length === 0).toBe(valid)
    if (failed) {
      expect(sorted(invalid)).toEqual(sorted(failed))
    }
  })

  // KNOWN BUG: RQ-CAT-07 exige coherencia required/min/max. El DTO valida cada campo por
  // separado pero no la relación, por lo que `required: true` sin `min` y `min > max`
  // pasan la validación sin error.
  it.each([
    { name: 'required true sin min', payload: base },
    { name: 'min mayor que max', payload: { ...base, min: 5, max: 1 } },
  ])('KNOWN BUG: acepta grupo inconsistente ($name)', async ({ payload }) => {
    const { invalid } = await check(CreateConfigGroupDto, payload)

    expect(invalid).toEqual([])
  })
})

describe('UpdateConfigGroupDto (RQ-CAT-07)', () => {
  it.each([
    { name: 'payload vacío', payload: {}, valid: true },
    { name: 'tipo válido', payload: { type: CONFIG_GROUP_TYPE.multiple }, valid: true },
    { name: 'min 0', payload: { min: 0 }, valid: true },
    { name: 'tipo inválido', payload: { type: 'triple' }, valid: false },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'min negativo', payload: { min: -1 }, valid: false },
    { name: 'max decimal', payload: { max: 2.5 }, valid: false },
    { name: 'required no booleano', payload: { required: 'si' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateConfigGroupDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('CreateConfigOptionDto (RQ-CAT-08)', () => {
  const base = { name: 'Bacon', extraPrice: 25 }

  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean; failed?: string[] }> = [
    { name: 'opción válida', payload: base, valid: true },
    { name: 'precio extra 0 (límite)', payload: { ...base, extraPrice: 0 }, valid: true },
    { name: 'available false', payload: { ...base, available: false }, valid: true },
    { name: 'sin nombre', payload: { extraPrice: 1 }, valid: false, failed: ['name'] },
    { name: 'nombre vacío', payload: { ...base, name: '' }, valid: false, failed: ['name'] },
    { name: 'nombre de 101 caracteres', payload: { ...base, name: 'a'.repeat(101) }, valid: false, failed: ['name'] },
    { name: 'sin precio extra', payload: { name: 'Bacon' }, valid: false, failed: ['extraPrice'] },
    { name: 'precio extra string', payload: { ...base, extraPrice: '25' }, valid: false, failed: ['extraPrice'] },
    { name: 'precio extra NaN', payload: { ...base, extraPrice: Number.NaN }, valid: false, failed: ['extraPrice'] },
    { name: 'available no booleano', payload: { ...base, available: 'si' }, valid: false, failed: ['available'] },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid, failed }) => {
    const { invalid } = await check(CreateConfigOptionDto, payload)

    expect(invalid.length === 0).toBe(valid)
    if (failed) {
      expect(sorted(invalid)).toEqual(sorted(failed))
    }
  })

  // KNOWN BUG: RQ-CAT-08 modela la variación como `+$`; el DTO acepta precios extra
  // negativos porque no tiene @Min(0), permitiendo abaratar una opción de configuración.
  it.each([
    { name: 'precio extra negativo', extraPrice: -10 },
    { name: 'precio extra muy negativo', extraPrice: -999 },
  ])('KNOWN BUG: acepta $name sin error', async ({ extraPrice }) => {
    const { invalid } = await check(CreateConfigOptionDto, { name: 'Descuento', extraPrice })

    expect(invalid).toEqual([])
  })
})

describe('UpdateConfigOptionDto (RQ-CAT-08)', () => {
  it.each([
    { name: 'payload vacío', payload: {}, valid: true },
    { name: 'nombre', payload: { name: 'Nuevo' }, valid: true },
    { name: 'precio extra 0', payload: { extraPrice: 0 }, valid: true },
    { name: 'available false', payload: { available: false }, valid: true },
    { name: 'nombre vacío', payload: { name: '' }, valid: false },
    { name: 'precio extra string', payload: { extraPrice: 'x' }, valid: false },
    { name: 'available no booleano', payload: { available: 'no' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(UpdateConfigOptionDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('RecipeOptionAdjustmentDto (RQ-CAT-12)', () => {
  it.each([
    { name: 'ajuste válido', payload: { optionId: 'opt1', quantity: 2 }, valid: true },
    { name: 'cantidad 0 (límite)', payload: { optionId: 'opt1', quantity: 0 }, valid: true },
    { name: 'cantidad decimal', payload: { optionId: 'opt1', quantity: 1.5 }, valid: true },
    { name: 'sin optionId', payload: { quantity: 2 }, valid: false },
    { name: 'optionId vacío', payload: { optionId: '', quantity: 2 }, valid: false },
    { name: 'optionId numérico', payload: { optionId: 1, quantity: 2 }, valid: false },
    { name: 'cantidad negativa', payload: { optionId: 'opt1', quantity: -1 }, valid: false },
    { name: 'cantidad string', payload: { optionId: 'opt1', quantity: '2' }, valid: false },
    { name: 'sin cantidad', payload: { optionId: 'opt1' }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(RecipeOptionAdjustmentDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })

  // KNOWN BUG: la cantidad base/ajustada de un ingrediente debería ser > 0. @Min(0) permite
  // 0, que en el cálculo de requerimientos (order.orchestrator) anula el ingrediente.
  it('KNOWN BUG: acepta cantidad 0 como ajuste de receta', async () => {
    const { invalid } = await check(RecipeOptionAdjustmentDto, { optionId: 'opt1', quantity: 0 })

    expect(invalid).toEqual([])
  })
})

describe('RecipeItemDto (RQ-CAT-11/12)', () => {
  it.each([
    { name: 'ítem válido', payload: { ingredientId: 'ing1', quantity: 2 }, valid: true },
    { name: 'cantidad 0 (límite)', payload: { ingredientId: 'ing1', quantity: 0 }, valid: true },
    { name: 'cantidad decimal', payload: { ingredientId: 'ing1', quantity: 0.5 }, valid: true },
    {
      name: 'con ajustes por opción válidos',
      payload: { ingredientId: 'ing1', quantity: 1, optionAdjustments: [{ optionId: 'opt1', quantity: 2 }] },
      valid: true,
    },
    { name: 'sin ingredientId', payload: { quantity: 2 }, valid: false },
    { name: 'ingredientId vacío', payload: { ingredientId: '', quantity: 2 }, valid: false },
    { name: 'sin cantidad', payload: { ingredientId: 'ing1' }, valid: false },
    { name: 'cantidad negativa', payload: { ingredientId: 'ing1', quantity: -1 }, valid: false },
    { name: 'cantidad string', payload: { ingredientId: 'ing1', quantity: '2' }, valid: false },
    { name: 'optionAdjustments no es array', payload: { ingredientId: 'ing1', quantity: 1, optionAdjustments: 'x' }, valid: false },
    {
      name: 'ajuste anidado sin optionId',
      payload: { ingredientId: 'ing1', quantity: 1, optionAdjustments: [{ quantity: 2 }] },
      valid: false,
    },
    {
      name: 'ajuste anidado con cantidad negativa',
      payload: { ingredientId: 'ing1', quantity: 1, optionAdjustments: [{ optionId: 'opt1', quantity: -2 }] },
      valid: false,
    },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(RecipeItemDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })

  it('valida los ajustes anidados y marca la propiedad optionAdjustments', async () => {
    const { invalid } = await check(RecipeItemDto, {
      ingredientId: 'ing1',
      quantity: 1,
      optionAdjustments: [{ quantity: 2 }],
    })

    expect(invalid).toContain('optionAdjustments')
  })
})

describe('SetRecipeDto (RQ-CAT-11)', () => {
  it.each([
    { name: 'lista vacía (limpiar receta)', payload: { items: [] }, valid: true },
    { name: 'un ítem válido', payload: { items: [{ ingredientId: 'ing1', quantity: 2 }] }, valid: true },
    {
      name: 'varios ítems con ajustes',
      payload: {
        items: [
          { ingredientId: 'ing1', quantity: 1, optionAdjustments: [{ optionId: 'opt1', quantity: 3 }] },
          { ingredientId: 'ing2', quantity: 2 },
        ],
      },
      valid: true,
    },
    { name: 'sin items', payload: {}, valid: false },
    { name: 'items no es array', payload: { items: 'x' }, valid: false },
    { name: 'ítem anidado inválido', payload: { items: [{ quantity: 2 }] }, valid: false },
    {
      name: 'ajuste anidado inválido',
      payload: { items: [{ ingredientId: 'ing1', quantity: 1, optionAdjustments: [{ optionId: 'opt1', quantity: -1 }] }] },
      valid: false,
    },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(SetRecipeDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('ProductQueryDto (RQ-CAT-05)', () => {
  it.each([
    { name: 'vacío (defaults en el controller)', payload: {}, valid: true },
    { name: 'categoría', payload: { categoryId: 'cat1' }, valid: true },
    { name: 'search de 100 caracteres (límite)', payload: { search: 'a'.repeat(100) }, valid: true },
    { name: 'available true', payload: { available: true }, valid: true },
    { name: 'available false', payload: { available: false }, valid: true },
    { name: 'limit 1 (mínimo)', payload: { limit: 1 }, valid: true },
    { name: 'limit 100 (máximo)', payload: { limit: 100 }, valid: true },
    { name: 'offset 0', payload: { offset: 0 }, valid: true },
    { name: 'search de 101 caracteres', payload: { search: 'a'.repeat(101) }, valid: false },
    { name: 'search numérico', payload: { search: 10 }, valid: false },
    { name: 'limit 0', payload: { limit: 0 }, valid: false },
    { name: 'limit 101', payload: { limit: 101 }, valid: false },
    { name: 'limit decimal', payload: { limit: 1.5 }, valid: false },
    { name: 'limit no numérico', payload: { limit: 'abc' }, valid: false },
    { name: 'offset negativo', payload: { offset: -1 }, valid: false },
    { name: 'categoryId numérico', payload: { categoryId: 1 }, valid: false },
  ])('$name → $valid', async ({ payload, valid }) => {
    const { invalid } = await check(ProductQueryDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })

  it('convierte limit string a número por el decorador @Type', async () => {
    const { instance, invalid } = await check(ProductQueryDto, { limit: '5', offset: '10' })

    expect(invalid).toEqual([])
    expect(instance.limit).toBe(5)
    expect(instance.offset).toBe(10)
  })

  it.each([
    { name: 'available "true" se transforma a true', input: 'true', expected: true },
    { name: 'available true se mantiene true', input: true, expected: true },
    { name: 'available "false" se transforma a false', input: 'false', expected: false },
  ])('transforma $name', async ({ input, expected }) => {
    const { instance, invalid } = await check(ProductQueryDto, { available: input })

    expect(invalid).toEqual([])
    expect(instance.available).toBe(expected)
  })

  // KNOWN BUG: el @Transform de `available` coacciona cualquier valor desconocido a false
  // en lugar de rechazarlo. `available=garbage` se acepta como "no disponibles", ocultando
  // datos en el catálogo público por un parámetro malformado.
  it('KNOWN BUG: available con valor inválido se coacciona a false sin error', async () => {
    const { instance, invalid } = await check(ProductQueryDto, { available: 'garbage' })

    expect(invalid).toEqual([])
    expect(instance.available).toBe(false)
  })
})
