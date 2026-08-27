import { Injectable, Logger } from '@nestjs/common'
import { ORDER_STATUS, PARAMETER_KEYS } from '../config/constants'
import { env } from '../config/env'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'

const ORDER_STATE_SEED = [
  { code: ORDER_STATUS.pending, name: 'Pendiente', order: 0 },
  { code: ORDER_STATUS.confirmed, name: 'Confirmado', order: 1 },
  { code: ORDER_STATUS.preparing, name: 'En preparación', order: 2 },
  { code: ORDER_STATUS.readyForDelivery, name: 'Listo para entregar', order: 3 },
  { code: ORDER_STATUS.onTheWay, name: 'En camino', order: 4 },
  { code: ORDER_STATUS.delivered, name: 'Entregado', order: 5 },
  { code: ORDER_STATUS.cancelled, name: 'Cancelado', order: 6 },
]

const PARAMETER_SEED = [
  { key: PARAMETER_KEYS.maxDistanceKm, value: env.seed.maxDistanceKm, unit: 'km' },
  { key: PARAMETER_KEYS.basePrepMin, value: env.seed.basePrepMin, unit: 'min' },
  { key: PARAMETER_KEYS.avgSpeedKmh, value: env.seed.avgSpeedKmh, unit: 'km/h' },
]

@Injectable()
export class SeedService {
  constructor(
    private readonly orderStateService: OrderStateService,
    private readonly parameterService: ParameterService,
  ) {}

  async seedOrderStates(): Promise<void> {
    for (const state of ORDER_STATE_SEED) {
      const existing = await this.orderStateService.findByCode(state.code)
      if (!existing) {
        await this.orderStateService.create(state)
        Logger.log(`order-state creado: ${state.code}`, 'Seed')
      }
    }
  }

  async seedParameters(): Promise<void> {
    for (const parameter of PARAMETER_SEED) {
      const existing = await this.parameterService.findByKey(parameter.key)
      if (!existing) {
        await this.parameterService.create(parameter)
        Logger.log(`parameter creado: ${parameter.key}`, 'Seed')
      }
    }
  }

  async seed(): Promise<void> {
    await this.seedOrderStates()
    await this.seedParameters()
  }
}
