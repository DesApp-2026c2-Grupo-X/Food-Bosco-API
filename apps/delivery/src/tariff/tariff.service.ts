import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { join } from 'node:path'

import { loadSeedData } from '@repo/seed-utils'

import { ERROR_CODES } from '../config/constants'
import type { PublicDeliveryTariff } from './tariff.model'
import { serializeDeliveryTariff } from './tariff.model'
import { TariffRepository } from './tariff.repository'

interface TariffSeed {
  baseFare: number
  perKm: number
  perOrder: number
  currency: string
}

interface DeliverySeedData {
  tariff?: TariffSeed
}

export interface PublishTariffInput {
  baseFare: number
  perKm: number
  perOrder: number
  currency?: string
  createdBy: string
}

const BOOTSTRAP_AUTHOR = 'system:bootstrap'
const DEFAULT_CURRENCY = 'ARS'
const DATA_DIR = join(__dirname, '../seed/data')

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000

@Injectable()
export class TariffService implements OnModuleInit {
  private readonly logger = new Logger(TariffService.name)
  private bootstrapInFlight: Promise<void> | null = null

  constructor(private readonly repository: TariffRepository) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBootstrap()
    } catch (error) {
      this.logger.warn(`No se pudo preparar la tarifa inicial: ${String(error)}`)
    }
  }

  async getActive(): Promise<PublicDeliveryTariff> {
    let doc = await this.repository.findActive()

    if (!doc) {
      await this.ensureBootstrap()
      doc = await this.repository.findActive()
    }

    if (!doc) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.tariffNotAvailable,
        message: 'No hay una tarifa de delivery vigente.',
      })
    }

    return serializeDeliveryTariff(doc)
  }

  async listHistory(limit = 20): Promise<PublicDeliveryTariff[]> {
    const docs = await this.repository.findHistory(limit)
    return docs.map(serializeDeliveryTariff)
  }

  async publish(input: PublishTariffInput): Promise<PublicDeliveryTariff> {
    const data = this.normalize(input)
    const previous = await this.repository.findActive()
    const created = await this.repository.insertInactive({ ...data, effectiveFrom: new Date() })

    try {
      await this.repository.deactivateAll()
      const activated = await this.repository.activateById(created._id.toString())

      if (!activated) {
        throw new Error('No se pudo activar la tarifa publicada')
      }

      return serializeDeliveryTariff(activated)
    } catch (error) {
      await this.compensate(previous)
      if (isDuplicateKeyError(error)) {
        throw new ConflictException({
          code: ERROR_CODES.tariffConflict,
          message: 'Otra tarifa fue publicada al mismo tiempo. Actualizá e intentá de nuevo.',
        })
      }
      throw error
    }
  }

  async ensureBootstrap(): Promise<void> {
    if ((await this.repository.countActive()) > 0) {
      return
    }

    if (!this.bootstrapInFlight) {
      this.bootstrapInFlight = this.bootstrapFromSeed().finally(() => {
        this.bootstrapInFlight = null
      })
    }

    return this.bootstrapInFlight
  }

  private async bootstrapFromSeed(): Promise<void> {
    const seed = this.loadSeedTariff()
    const created = await this.insertBootstrapTariff(seed)

    if (!created) return

    try {
      await this.repository.deactivateAll()
      await this.repository.activateById(created._id.toString())
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
    }
  }

  private async insertBootstrapTariff(
    seed: TariffSeed,
  ): Promise<{ _id: { toString(): string } } | null> {
    try {
      return await this.repository.insertInactive({
        ...seed,
        effectiveFrom: new Date(),
        createdBy: BOOTSTRAP_AUTHOR,
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  }

  private async compensate(previous: { _id: { toString(): string } } | null): Promise<void> {
    if (!previous) return

    try {
      await this.repository.activateById(previous._id.toString())
    } catch {
      // Si otra publicación ya ganó la carrera, la tarifa vigente se conserva.
    }
  }

  private normalize(input: PublishTariffInput): Omit<PublishTariffInput, 'currency'> & {
    currency: string
  } {
    const baseFare = this.requireAmount('baseFare', input.baseFare)
    const perKm = this.requireAmount('perKm', input.perKm)
    const perOrder = this.requireAmount('perOrder', input.perOrder)
    const currency = (input.currency ?? DEFAULT_CURRENCY).trim().toUpperCase()
    const createdBy = input.createdBy?.trim()

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException({
        code: ERROR_CODES.validationError,
        message: 'La moneda debe tener exactamente 3 letras.',
      })
    }

    if (!createdBy) {
      throw new BadRequestException({
        code: ERROR_CODES.validationError,
        message: 'El autor de la tarifa es obligatorio.',
      })
    }

    return { baseFare, perKm, perOrder, currency, createdBy }
  }

  private requireAmount(field: string, value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException({
        code: ERROR_CODES.validationError,
        message: `El campo ${field} debe ser un número mayor o igual a 0.`,
      })
    }

    return value
  }

  private loadSeedTariff(): TariffSeed {
    const data = loadSeedData<DeliverySeedData>('delivery', { baseDir: DATA_DIR })

    if (!data.tariff) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.tariffNotAvailable,
        message: 'No hay una tarifa configurada para inicializar el servicio.',
      })
    }

    return {
      baseFare: this.requireAmount('baseFare', data.tariff.baseFare),
      perKm: this.requireAmount('perKm', data.tariff.perKm),
      perOrder: this.requireAmount('perOrder', data.tariff.perOrder),
      currency: (data.tariff.currency ?? DEFAULT_CURRENCY).trim().toUpperCase(),
    }
  }
}
