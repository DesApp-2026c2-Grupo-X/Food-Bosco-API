import { Injectable, Logger } from '@nestjs/common'

import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'
import { join } from 'node:path'

import { envString, loadSeedData } from '@repo/seed-utils'

import { DeliveryOrderRepository } from '../delivery-order/delivery-order.repository'
import { normalizeVehicle } from '../rider/rider.model'
import { RiderService } from '../rider/rider.service'
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
  vehicle?: string | null
}

export interface SeedLocation {
  latitude: number
  longitude: number
}

export interface SeedReadyOrder {
  orderId: string
  branchId: string
  branchLocation: SeedLocation
  deliveryAddress: { text: string } & SeedLocation
}

const DATA_DIR = join(__dirname, 'data')

export interface SeedRiderInput {
  userId: string
  firstName: string
  lastName: string
  phone: string
  vehicle?: string | null
  available?: boolean
  location?: SeedLocation
  readyOrder?: SeedReadyOrder
}

export interface SeedResult {
  summary: {
    zones: number
    shifts: number
    riders: number
  }
  rider: { id: string; userId: string } | null
  readyOrderId: string | null
}

@Injectable()
export class SeedService {
  constructor(
    private readonly riderService: RiderService,
    private readonly zoneService: ZoneService,
    private readonly shiftService: ShiftService,
    private readonly deliveryOrderRepository: DeliveryOrderRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

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
      readyOrderId: null,
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

    const rider =
      existing ??
      (await this.riderService.create({
        userId: input.userId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        vehicle: normalizeVehicle(input.vehicle),
      }))

    if (!existing) {
      Logger.log(`rider creado: ${input.firstName} ${input.lastName}`, 'Seed')
    }

    await this.applyPresence(input)
    const readyOrderId = await this.seedReadyOrder(input.readyOrder)

    return {
      summary: {
        zones: 0,
        shifts: 0,
        riders: 1,
      },
      rider: {
        id: rider.id,
        userId: rider.userId,
      },
      readyOrderId,
    }
  }

  private async applyPresence(input: SeedRiderInput): Promise<void> {
    if (input.available !== undefined) {
      await this.riderService.setAvailability(input.userId, input.available)
    }

    if (input.location) {
      await this.riderService.updateLocation(
        input.userId,
        input.location.latitude,
        input.location.longitude,
      )
    }
  }

  private async seedReadyOrder(readyOrder?: SeedReadyOrder): Promise<string | null> {
    if (!readyOrder) return null

    const doc = await this.deliveryOrderRepository.upsertReady({
      orderId: readyOrder.orderId,
      branchId: readyOrder.branchId,
      branchLocation: readyOrder.branchLocation,
      deliveryAddress: readyOrder.deliveryAddress,
    })

    if (doc) {
      Logger.log(`pedido listo para ofertas: ${readyOrder.orderId}`, 'Seed')
    }

    return doc?.orderId ?? null
  }

  private async seedRiderProfileFromAuth(): Promise<{
    id: string
    userId: string
  } | null> {
    const email = envString('SEED_RIDER_EMAIL', this.loadData().rider.email)

    const collection = this.connection.db?.collection('users')

    const user = (await collection?.findOne({
      email,
    })) as AuthUserRow | null | undefined

    if (!user?._id) {
      Logger.warn(`usuario rider no encontrado en auth (${email}); perfil omitido`, 'Seed')
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
