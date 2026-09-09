import { registerEnumType } from '@nestjs/graphql'

export enum TripStatus {
  OFFERED = 'OFFERED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(TripStatus, { name: 'TripStatus' })

const BY_STRING: Record<string, TripStatus> = {
  offered: TripStatus.OFFERED,
  active: TripStatus.ACTIVE,
  completed: TripStatus.COMPLETED,
  cancelled: TripStatus.CANCELLED,
}

export const tripStatusFromRest = (value: string): TripStatus => {
  const status = BY_STRING[value.toLowerCase()]
  if (!status) {
    throw new Error(`Unknown trip status: ${value}`)
  }
  return status
}
