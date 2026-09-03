import { Injectable, Logger } from '@nestjs/common'
import { RiderService } from '../rider/rider.service'

export interface SeedRiderInput {
  userId: string
  firstName: string
  lastName: string
  phone: string
  vehicle?: string | null
}

export interface SeedResult {
  summary: { riders: number }
  rider: { id: string; userId: string }
}

@Injectable()
export class SeedService {
  constructor(private readonly riderService: RiderService) {}

  async seedRiderProfile(input: SeedRiderInput): Promise<SeedResult> {
    const existing = await this.riderService.findByUserId(input.userId)
    if (existing) {
      return { summary: { riders: 1 }, rider: { id: existing.id, userId: existing.userId } }
    }

    const created = await this.riderService.create({
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      vehicle: input.vehicle ?? null,
    })

    Logger.log(`rider creado: ${input.firstName} ${input.lastName}`, 'Seed')
    return { summary: { riders: 1 }, rider: { id: created.id, userId: created.userId } }
  }
}
