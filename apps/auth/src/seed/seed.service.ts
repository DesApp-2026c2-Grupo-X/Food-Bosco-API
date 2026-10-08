import { Injectable, Logger } from '@nestjs/common'

import { join } from 'node:path'

import { isDuplicateKeyError, loadSeedData } from '@repo/seed-utils'

import { AddressService } from '../address/address.service'

import { ERROR_CODES, Role } from '../config/constants'

import { DomainException } from '../config/exceptions/domain.exception'

import { env } from '../config/env'

import { UserService, type PublicUser } from '../user/user.service'

interface SeedUser {
  key: string
  email: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  branch?: string
  vehicle?: string | null
}

interface SeedAddress {
  key: string
  label: string
  text: string
  city?: string
  postalCode?: string
  latitude: number
  longitude: number
}

interface AuthSeedData {
  users: SeedUser[]
  addresses?: SeedAddress[]
}

export interface SeedBranch {
  id: string
  name: string
}

export interface SeedOptions {
  branchId?: string
  branches?: SeedBranch[]
}

const DATA_DIR = join(__dirname, 'data')

const PASSWORDS: Record<string, string> = {
  superAdmin: env.seed.superAdminPassword,
  customer: env.seed.customerPassword,
  branchAdmin: env.seed.branchAdminPassword,
  rider: env.seed.riderPassword,
}

export interface SeedUserSummary {
  id: string
  email: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  vehicle: string | null
}

export interface SeedAddressSummary {
  userId: string
  id: string
  label: string
  text: string
  latitude: number
  longitude: number
}

export interface SeedResult {
  summary: { users: number; addresses: number }
  users: SeedUserSummary[]
  addresses: SeedAddressSummary[]
}

const toUserSummary = (user: PublicUser): SeedUserSummary => ({
  id: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  vehicle: user.vehicle,
})

@Injectable()
export class SeedService {
  constructor(
    private readonly userService: UserService,
    private readonly addressService: AddressService,
  ) {}

  async seed(options: SeedOptions = {}): Promise<SeedResult> {
    const data = this.loadData()
    const users: PublicUser[] = []
    const userByKey = new Map<string, PublicUser>()

    for (const seed of data.users) {
      if (seed.key === 'branchAdmin') continue

      const created = await this.ensureSeedUser(seed, null)
      if (!created) continue

      users.push(created)
      userByKey.set(seed.key, created)
    }

    for (const { seed, branchId } of this.resolveBranchAdmins(data.users, options)) {
      const created = await this.ensureSeedUser(seed, branchId)
      if (created) users.push(created)
    }

    const addresses = await this.seedAddresses(data.addresses ?? [], userByKey)

    return {
      summary: { users: users.length, addresses: addresses.length },
      users: users.map(toUserSummary),
      addresses,
    }
  }

  private resolveBranchAdmins(
    users: SeedUser[],
    options: SeedOptions,
  ): { seed: SeedUser; branchId: string }[] {
    const admins = users.filter((user) => user.key === 'branchAdmin')

    if (options.branches && options.branches.length > 0) {
      return options.branches
        .map((branch) => {
          const seed = admins.find((admin) => admin.branch === branch.name)
          return seed ? { seed, branchId: branch.id } : null
        })
        .filter((entry): entry is { seed: SeedUser; branchId: string } => entry !== null)
    }

    if (options.branchId) {
      const seed = admins.find((admin) => !admin.branch)
      return seed ? [{ seed, branchId: options.branchId }] : []
    }

    return []
  }

  private async seedAddresses(
    seeds: SeedAddress[],
    userByKey: Map<string, PublicUser>,
  ): Promise<SeedAddressSummary[]> {
    const result: SeedAddressSummary[] = []

    for (const seed of seeds) {
      const user = userByKey.get(seed.key)
      if (!user) continue

      const existing = (await this.addressService.listByUser(user.id)).data.find(
        (address) => address.label === seed.label,
      )

      if (existing) {
        result.push(this.toAddressSummary(user.id, existing))
        continue
      }

      const created = await this.addressService.create(user.id, {
        label: seed.label,
        text: seed.text,
        city: seed.city,
        postalCode: seed.postalCode,
        latitude: seed.latitude,
        longitude: seed.longitude,
      })

      result.push(this.toAddressSummary(user.id, created))
      Logger.log(`dirección creada: ${created.label} (${user.email})`, 'Seed')
    }

    return result
  }

  private toAddressSummary(
    userId: string,
    address: { id: string; label: string; text: string; latitude: number; longitude: number },
  ): SeedAddressSummary {
    return {
      userId,
      id: address.id,
      label: address.label,
      text: address.text,
      latitude: address.latitude,
      longitude: address.longitude,
    }
  }

  private async ensureSeedUser(
    seed: SeedUser,
    branchId: string | null,
  ): Promise<PublicUser | null> {
    const password = PASSWORDS[seed.key]

    if (!password) {
      Logger.warn(`usuario de seed sin contraseña configurada: ${seed.key}`, 'Seed')
      return null
    }

    return this.ensureUser({
      email: seed.email,
      password,
      role: seed.role,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phone: seed.phone,
      branchId,
      vehicle: seed.vehicle ?? null,
    })
  }

  private async ensureUser(input: {
    email: string
    password: string
    role: Role
    firstName: string
    lastName: string
    phone: string
    branchId?: string | null
    vehicle?: string | null
  }): Promise<PublicUser> {
    const existing = await this.userService.findByEmail(input.email)

    if (existing) {
      return existing
    }

    try {
      const created = await this.userService.createUser(input)

      Logger.log(`usuario creado: ${created.email} (${created.role})`, 'Seed')

      return created
    } catch (error: unknown) {
      const race = isDuplicateKeyError(error)
      const alreadyTaken = error instanceof DomainException && error.code === ERROR_CODES.emailTaken

      if (!race && !alreadyTaken) throw error

      return (await this.userService.findByEmail(input.email))!
    }
  }

  private loadData(): AuthSeedData {
    return loadSeedData<AuthSeedData>('auth', { baseDir: DATA_DIR })
  }
}
