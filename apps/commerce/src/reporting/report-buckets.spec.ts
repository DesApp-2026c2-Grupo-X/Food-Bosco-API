import type { ReportGroupBy } from './reporting.model'
import { enumerateReportBuckets, fillReportSeries } from './report-buckets'

interface EnumerateCase {
  name: string
  from: string
  to: string
  groupBy: ReportGroupBy
  expected: string[]
}

const enumerateCases: EnumerateCase[] = [
  {
    name: 'horas consecutivas en un rango corto',
    from: '2026-01-01T10:00:00.000-03:00',
    to: '2026-01-01T12:59:59.999-03:00',
    groupBy: 'hour',
    expected: ['2026-01-01T10', '2026-01-01T11', '2026-01-01T12'],
  },
  {
    name: 'un día completo genera 24 horas en el huso horario del negocio',
    from: '2026-01-01T00:00:00.000-03:00',
    to: '2026-01-01T23:59:59.999-03:00',
    groupBy: 'hour',
    expected: Array.from(
      { length: 24 },
      (_, hour) => `2026-01-01T${String(hour).padStart(2, '0')}`,
    ),
  },
  {
    name: 'días consecutivos',
    from: '2026-01-01T00:00:00.000-03:00',
    to: '2026-01-03T23:59:59.999-03:00',
    groupBy: 'day',
    expected: ['2026-01-01', '2026-01-02', '2026-01-03'],
  },
  {
    name: 'un solo día',
    from: '2026-01-01T00:00:00.000-03:00',
    to: '2026-01-01T23:59:59.999-03:00',
    groupBy: 'day',
    expected: ['2026-01-01'],
  },
  {
    name: 'usa el huso horario del negocio para el límite del día',
    from: '2026-01-01T02:00:00.000Z',
    to: '2026-01-01T02:00:00.000Z',
    groupBy: 'day',
    expected: ['2025-12-31'],
  },
  {
    name: 'semanas ISO consecutivas',
    from: '2026-01-05T00:00:00.000-03:00',
    to: '2026-01-18T23:59:59.999-03:00',
    groupBy: 'week',
    expected: ['2026-W02', '2026-W03'],
  },
  {
    name: 'semana ISO que cruza el cambio de año',
    from: '2025-12-29T00:00:00.000-03:00',
    to: '2026-01-04T23:59:59.999-03:00',
    groupBy: 'week',
    expected: ['2026-W01'],
  },
  {
    name: 'rango de dos días dentro de la misma semana',
    from: '2026-01-07T00:00:00.000-03:00',
    to: '2026-01-08T23:59:59.999-03:00',
    groupBy: 'week',
    expected: ['2026-W02'],
  },
  {
    name: 'meses consecutivos',
    from: '2025-11-24T00:00:00.000-03:00',
    to: '2026-01-02T23:59:59.999-03:00',
    groupBy: 'month',
    expected: ['2025-11', '2025-12', '2026-01'],
  },
  {
    name: 'un solo mes',
    from: '2026-01-15T00:00:00.000-03:00',
    to: '2026-01-20T23:59:59.999-03:00',
    groupBy: 'month',
    expected: ['2026-01'],
  },
]

describe('enumerateReportBuckets', () => {
  it.each(enumerateCases)('$name', ({ from, to, groupBy, expected }) => {
    expect(enumerateReportBuckets(new Date(from), new Date(to), groupBy)).toEqual(expected)
  })
})

describe('fillReportSeries', () => {
  const empty = (bucket: string) => ({ bucket, revenue: 0, orders: 0 })

  it('agrega los períodos sin actividad con valores en cero', () => {
    const rows = [
      { bucket: '2026-01-01', revenue: 500, orders: 2 },
      { bucket: '2026-01-04', revenue: 300, orders: 1 },
    ]

    const result = fillReportSeries(
      rows,
      new Date('2026-01-01T00:00:00.000-03:00'),
      new Date('2026-01-05T23:59:59.999-03:00'),
      'day',
      empty,
    )

    expect(result).toEqual([
      { bucket: '2026-01-01', revenue: 500, orders: 2 },
      { bucket: '2026-01-02', revenue: 0, orders: 0 },
      { bucket: '2026-01-03', revenue: 0, orders: 0 },
      { bucket: '2026-01-04', revenue: 300, orders: 1 },
      { bucket: '2026-01-05', revenue: 0, orders: 0 },
    ])
  })

  it('ordena los períodos aunque la agregación llegue desordenada', () => {
    const rows = [
      { bucket: '2026-02', revenue: 0, orders: 0 },
      { bucket: '2026-01', revenue: 100, orders: 1 },
    ]

    const result = fillReportSeries(
      rows,
      new Date('2026-01-01T00:00:00.000-03:00'),
      new Date('2026-02-28T23:59:59.999-03:00'),
      'month',
      empty,
    )

    expect(result.map((row) => row.bucket)).toEqual(['2026-01', '2026-02'])
  })

  it('devuelve todos los períodos en cero cuando no hay actividad', () => {
    const result = fillReportSeries(
      [],
      new Date('2026-01-01T00:00:00.000-03:00'),
      new Date('2026-01-03T23:59:59.999-03:00'),
      'day',
      empty,
    )

    expect(result).toHaveLength(3)
    expect(result.every((row) => row.revenue === 0 && row.orders === 0)).toBe(true)
  })
})
