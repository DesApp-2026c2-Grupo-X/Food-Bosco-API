import { Injectable, Logger } from '@nestjs/common'

import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'
import { join } from 'node:path'

import { envString, loadSeedData } from '@repo/seed-utils'

import { RiderService } from '../rider/rider.service'
import type { Vehicle } from '../rider/rider.model'
import { ShiftService } from '../shift/shift.service'
import { ZoneService } from '../zone/zone.service'

interface ZoneSeed {
  name: string
  center: { latitude: number; longitude: number }
  radiusKm: number
}

interface ShiftSeed {
  name: string
  startTime: string
  endTime: string
}

interface DeliverySeedData {
  zones: ZoneSeed[]
  shifts: ShiftSeed[]
  rider: { email: string }
}

interface AuthUserRow {
  _id: { toString(): string }
  firstName?: string
  lastName?: string
  phone?: string
  vehicle?: Vehicle | null
}

const DATA_DIR = join(__dirname, 'data')

export interface SeedRiderInput {
  userId: string
  firstName: string
  lastName: string
  phone: string
  vehicle?: Vehicle | null
}

export interface SeedResult {
  summary: {
    zones: number
    shifts: number
    riders: number
  }
  rider: { id: string; userId: string } | null
}

@Injectable()
export class SeedService {
  constructor(
    private readonly riderService: RiderService,
    private readonly zoneService: ZoneService,
    private readonly shiftService: ShiftService,
    @InjectConnection() private readonly connection: Connection,
  ) { }

  async seed(): Promise<SeedResult> {
    const zones = await this.seedZones()
    const shifts = await this.seedShifts()
    const rider = await this.seedRiderProfileFromAuth()

    return {
      summary: {
        zones,
        shifts,
        riders: rider ? 1 : 0,
      },
      rider,
    }
  }

  async seedZones(): Promise<number> {
    const zones = this.loadData().zones
    let created = 0

    for (const zone of zones) {
      const existing = await this.zoneService.findByName(zone.name)

      if (!existing) {
        await this.zoneService.create(zone)
        created += 1
        Logger.log(`zona creada: ${zone.name}`, 'Seed')
      }
    }

    return created
  }

  async seedShifts(): Promise<number> {
    const shifts = this.loadData().shifts
    let created = 0

    for (const shift of shifts) {
      const existing = await this.shiftService.findByName(shift.name)

      if (!existing) {
        await this.shiftService.create(shift)
        created += 1
        Logger.log(`turno creado: ${shift.name}`, 'Seed')
      }
    }

    return created
  }

  async seedRiderProfile(input: SeedRiderInput): Promise<SeedResult> {
    const existing = await this.riderService.findByUserId(input.userId)

    if (existing) {
      return {
        summary: {
          zones: 0,
          shifts: 0,
          riders: 1,
        },
        rider: {
          id: existing.id,
          userId: existing.userId,
        },
      }
    }

    const created = await this.riderService.create({
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      vehicle: input.vehicle ?? null,
    })

    Logger.log(
      `rider creado: ${input.firstName} ${input.lastName}`,
      'Seed',
    )

    return {
      summary: {
        zones: 0,
        shifts: 0,
        riders: 1,
      },
      rider: {
        id: created.id,
        userId: created.userId,
      },
    }
  }

  private async seedRiderProfileFromAuth(): Promise<{
    id: string
    userId: string
  } | null> {
    const email = envString(
      'SEED_RIDER_EMAIL',
      this.loadData().rider.email,
    )

    const collection = this.connection.db?.collection('users')

    const user = (await collection?.findOne({
      email,
    })) as AuthUserRow | null | undefined

    if (!user?._id) {
      Logger.warn(
        `usuario rider no encontrado en auth (${email}); perfil omitido`,
        'Seed',
      )
      return null
    }

    const result = await this.seedRiderProfile({
      userId: user._id.toString(),
      firstName: user.firstName ?? 'Rider',
      lastName: user.lastName ?? 'Demo',
      phone: user.phone ?? '',
      vehicle: user.vehicle ?? null,
    })

    return result.rider
  }

  private loadData(): DeliverySeedData {
    return loadSeedData<DeliverySeedData>('delivery', {
      baseDir: DATA_DIR,
    })
  }
}