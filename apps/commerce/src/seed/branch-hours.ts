import type { BranchHours } from '../branch/branch.model'

export interface TimeWindow {
  opening: string
  closing: string
}

export interface HoursSchedule {
  weekday: TimeWindow
  saturday: TimeWindow
  sunday: TimeWindow
}

/**
 * Expande el horario configurable (semana/sábado/domingo) a la lista completa de 7 días
 * que usa la sucursal. Días 1-5 usan `weekday`, 6 `saturday` y 0 `sunday`.
 */
export const buildBranchHours = (schedule: HoursSchedule): BranchHours[] => [
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    opening: schedule.weekday.opening,
    closing: schedule.weekday.closing,
    closed: false,
  })),
  {
    dayOfWeek: 6,
    opening: schedule.saturday.opening,
    closing: schedule.saturday.closing,
    closed: false,
  },
  {
    dayOfWeek: 0,
    opening: schedule.sunday.opening,
    closing: schedule.sunday.closing,
    closed: false,
  },
]
