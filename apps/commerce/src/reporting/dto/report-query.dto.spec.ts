import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ReportQueryDto } from './report-query.dto'

type DtoClass = new () => object

const check = async (cls: DtoClass, payload: Record<string, unknown>): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, payload))
  return errors.map((error) => error.property)
}

describe('ReportQueryDto (RQ-REP-07/08/09)', () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; valid: boolean }> = [
    { name: 'vacío', payload: {}, valid: true },
    { name: 'fecha desde ISO', payload: { from: '2026-01-01T00:00:00.000Z' }, valid: true },
    { name: 'fecha hasta ISO', payload: { to: '2026-01-31T23:59:59.999Z' }, valid: true },
    { name: 'agrupación por día', payload: { groupBy: 'day' }, valid: true },
    { name: 'agrupación por semana', payload: { groupBy: 'week' }, valid: true },
    { name: 'agrupación por mes', payload: { groupBy: 'month' }, valid: true },
    { name: 'sucursal', payload: { branchId: 'b1' }, valid: true },
    { name: 'categoría', payload: { categoryId: 'cat1' }, valid: true },
    { name: 'estado válido', payload: { status: 'delivered' }, valid: true },
    { name: 'fecha desde inválida', payload: { from: 'ayer' }, valid: false },
    { name: 'fecha hasta numérica', payload: { to: 123 }, valid: false },
    { name: 'agrupación inválida', payload: { groupBy: 'year' }, valid: false },
    { name: 'estado inválido', payload: { status: 'shipped' }, valid: false },
    { name: 'branchId numérico', payload: { branchId: 1 }, valid: false },
  ]

  it.each(cases)('$name → $valid', async ({ payload, valid }) => {
    const invalid = await check(ReportQueryDto, payload)

    expect(invalid.length === 0).toBe(valid)
  })
})
