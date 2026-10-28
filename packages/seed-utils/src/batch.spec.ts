import { createBatchId } from './batch'

describe('createBatchId', () => {
  it('combina el timestamp UTC compacto con la semilla en base 36', () => {
    const now = new Date('2026-10-27T20:15:11.500Z')

    expect(createBatchId(255, now)).toBe('20261027201511-73')
  })

  it('acepta semillas negativas sin romper el formato', () => {
    const now = new Date('2026-10-27T20:15:11.500Z')

    expect(createBatchId(-10, now)).toBe('20261027201511-a')
  })

  it('dos semillas distintas generan lotes distintos', () => {
    const now = new Date('2026-10-27T20:15:11.500Z')

    expect(createBatchId(1, now)).not.toBe(createBatchId(2, now))
  })
})
