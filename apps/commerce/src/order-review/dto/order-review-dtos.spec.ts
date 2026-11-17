import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateOrderReviewDto } from './create-order-review.dto'
import { ReviewQueryDto } from './review-query.dto'

type DtoClass = new () => object

const check = async (cls: DtoClass, payload: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, payload))
  return errors.map((error) => error.property)
}

describe('CreateOrderReviewDto', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'sólo sucursal con 5 estrellas', payload: { branchRating: 5 }, valid: true },
    { name: 'sólo sucursal con 1 estrella (límite)', payload: { branchRating: 1 }, valid: true },
    {
      name: 'sucursal y repartidor completos',
      payload: {
        branchRating: 4,
        branchComment: 'Muy rico',
        courierRating: 5,
        courierComment: 'Llegó rápido',
      },
      valid: true,
    },
    {
      name: 'comentario de 500 caracteres (límite)',
      payload: { branchRating: 4, branchComment: 'a'.repeat(500) },
      valid: true,
    },
    { name: 'puntaje 0', payload: { branchRating: 0 }, valid: false },
    { name: 'puntaje 6', payload: { branchRating: 6 }, valid: false },
    { name: 'puntaje decimal', payload: { branchRating: 4.5 }, valid: false },
    { name: 'puntaje como texto', payload: { branchRating: '4' }, valid: false },
    {
      name: 'comentario de 501 caracteres',
      payload: { branchRating: 4, branchComment: 'a'.repeat(501) },
      valid: false,
    },
    {
      name: 'repartidor con puntaje 0',
      payload: { branchRating: 4, courierRating: 0 },
      valid: false,
    },
    {
      name: 'repartidor con puntaje 6',
      payload: { branchRating: 4, courierRating: 6 },
      valid: false,
    },
    {
      name: 'comentario de repartidor no textual',
      payload: { branchRating: 4, courierComment: 123 },
      valid: false,
    },
  ]

  it.each(cases)('$name → validez $valid', async ({ payload, valid }) => {
    const errors = await check(CreateOrderReviewDto, payload)
    expect(errors.length === 0).toBe(valid)
  })
})

describe('ReviewQueryDto', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'sin filtros', payload: {}, valid: true },
    {
      name: 'rango ISO válido',
      payload: { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' },
      valid: true,
    },
    { name: 'límite 100 (máximo)', payload: { limit: 100 }, valid: true },
    { name: 'límite 0', payload: { limit: 0 }, valid: false },
    { name: 'límite 101', payload: { limit: 101 }, valid: false },
    { name: 'fecha inválida', payload: { from: 'ayer' }, valid: false },
  ]

  it.each(cases)('$name → validez $valid', async ({ payload, valid }) => {
    const errors = await check(ReviewQueryDto, payload)
    expect(errors.length === 0).toBe(valid)
  })
})
