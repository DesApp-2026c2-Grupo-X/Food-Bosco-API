import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AddCartItemDto } from './add-cart-item.dto'
import { UpdateCartItemDto } from './update-cart-item.dto'

type DtoClass = new () => object

const check = async (cls: DtoClass, payload: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, payload))
  return errors.map((error) => error.property)
}

describe('AddCartItemDto (RQ-CART-02/03)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'ítem mínimo válido', payload: { productId: 'p1', quantity: 1 }, valid: true },
    { name: 'cantidad 1 (mínimo)', payload: { productId: 'p1', quantity: 1 }, valid: true },
    { name: 'cantidad grande', payload: { productId: 'p1', quantity: 999 }, valid: true },
    { name: 'sin opciones', payload: { productId: 'p1', quantity: 2, optionIds: [] }, valid: true },
    { name: 'varias opciones', payload: { productId: 'p1', quantity: 2, optionIds: ['opt1', 'opt2'] }, valid: true },
    { name: 'observaciones de 500 caracteres (límite)', payload: { productId: 'p1', quantity: 1, observations: 'a'.repeat(500) }, valid: true },
    { name: 'sin productId', payload: { quantity: 1 }, valid: false },
    { name: 'productId vacío', payload: { productId: '', quantity: 1 }, valid: false },
    { name: 'productId numérico', payload: { productId: 1, quantity: 1 }, valid: false },
    { name: 'sin quantity', payload: { productId: 'p1' }, valid: false },
    { name: 'quantity 0', payload: { productId: 'p1', quantity: 0 }, valid: false },
    { name: 'quantity negativa', payload: { productId: 'p1', quantity: -1 }, valid: false },
    { name: 'quantity decimal', payload: { productId: 'p1', quantity: 1.5 }, valid: false },
    { name: 'quantity string', payload: { productId: 'p1', quantity: '2' }, valid: false },
    { name: 'observaciones de 501 caracteres', payload: { productId: 'p1', quantity: 1, observations: 'a'.repeat(501) }, valid: false },
    { name: 'optionIds no es array', payload: { productId: 'p1', quantity: 1, optionIds: 'opt1' }, valid: false },
    { name: 'optionIds con número', payload: { productId: 'p1', quantity: 1, optionIds: [1] }, valid: false },
    { name: 'optionIds con objeto', payload: { productId: 'p1', quantity: 1, optionIds: [{}] }, valid: false },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(AddCartItemDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})

describe('UpdateCartItemDto (RQ-CART-04)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'payload vacío (todo opcional)', payload: {}, valid: true },
    { name: 'solo cantidad', payload: { quantity: 1 }, valid: true },
    { name: 'cantidad grande', payload: { quantity: 999 }, valid: true },
    { name: 'solo observaciones', payload: { observations: 'sin sal' }, valid: true },
    { name: 'observaciones de 500 caracteres (límite)', payload: { observations: 'a'.repeat(500) }, valid: true },
    { name: 'lista de opciones vacía', payload: { optionIds: [] }, valid: true },
    { name: 'opciones válidas', payload: { optionIds: ['opt1', 'opt2'] }, valid: true },
    { name: 'quantity 0', payload: { quantity: 0 }, valid: false },
    { name: 'quantity negativa', payload: { quantity: -1 }, valid: false },
    { name: 'quantity decimal', payload: { quantity: 1.5 }, valid: false },
    { name: 'quantity string', payload: { quantity: '2' }, valid: false },
    { name: 'observaciones de 501 caracteres', payload: { observations: 'a'.repeat(501) }, valid: false },
    { name: 'optionIds no es array', payload: { optionIds: 'opt1' }, valid: false },
    { name: 'optionIds con número', payload: { optionIds: [1] }, valid: false },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(UpdateCartItemDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})
