import { buildBranchHours } from './branch-hours'
import type { HoursSchedule } from './branch-hours'

const schedule: HoursSchedule = {
  weekday: { opening: '09:00', closing: '23:00' },
  saturday: { opening: '10:00', closing: '23:00' },
  sunday: { opening: '10:00', closing: '22:00' },
}

describe('buildBranchHours (horarios configurables)', () => {
  it('genera exactamente los 7 días de la semana', () => {
    expect(buildBranchHours(schedule)).toHaveLength(7)
  })

  it.each([
    { dayOfWeek: 1, name: 'lunes' },
    { dayOfWeek: 2, name: 'martes' },
    { dayOfWeek: 3, name: 'miércoles' },
    { dayOfWeek: 4, name: 'jueves' },
    { dayOfWeek: 5, name: 'viernes' },
  ])('$name (día $dayOfWeek) usa el horario de semana', ({ dayOfWeek }) => {
    const hours = buildBranchHours(schedule)
    const day = hours.find((entry) => entry.dayOfWeek === dayOfWeek)

    expect(day).toEqual({ dayOfWeek, opening: '09:00', closing: '23:00', closed: false })
  })

  it('sábado (día 6) usa el horario de sábado', () => {
    const hours = buildBranchHours(schedule)
    const saturday = hours.find((entry) => entry.dayOfWeek === 6)

    expect(saturday).toEqual({ dayOfWeek: 6, opening: '10:00', closing: '23:00', closed: false })
  })

  it('domingo (día 0) usa el horario de domingo', () => {
    const hours = buildBranchHours(schedule)
    const sunday = hours.find((entry) => entry.dayOfWeek === 0)

    expect(sunday).toEqual({ dayOfWeek: 0, opening: '10:00', closing: '22:00', closed: false })
  })

  it('respeta horarios personalizados por entorno', () => {
    const custom: HoursSchedule = {
      weekday: { opening: '08:00', closing: '00:00' },
      saturday: { opening: '09:00', closing: '01:00' },
      sunday: { opening: '11:00', closing: '21:00' },
    }

    const hours = buildBranchHours(custom)

    expect(hours.find((entry) => entry.dayOfWeek === 1)).toMatchObject({
      opening: '08:00',
      closing: '00:00',
    })
    expect(hours.find((entry) => entry.dayOfWeek === 0)).toMatchObject({
      opening: '11:00',
      closing: '21:00',
    })
  })

  it('ningún día queda marcado como cerrado', () => {
    const hours = buildBranchHours(schedule)

    expect(hours.every((entry) => entry.closed === false)).toBe(true)
  })
})
