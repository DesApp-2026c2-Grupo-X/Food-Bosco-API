import { Injectable, Logger } from '@nestjs/common'

import { join } from 'node:path'

import { isDuplicateKeyError, loadSeedData } from '@repo/seed-utils'

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
  branchName?: string | null
  vehicle?: string | null
}

interface AuthSeedData {
  users: SeedUser[]
}

export interface SeedBranch {
  id: string
  name: string
}

const DATA_DIR = join(__dirname, 'data')

const PASSWORDS: Record<string, string> = {
  superAdmin: env.seed.superAdminPassword,
  customer: env.seed.customerPassword,
  rider: env.seed.riderPassword,
}

const normalizeBranchName = (value: string) => value.trim().toLowerCase()

const passwordFor = (seed: SeedUser): string | undefined =>
  seed.role === 'branch_admin' ? env.seed.branchAdminPassword : PASSWORDS[seed.key]

export interface SeedUserSummary {
  id: string
  email: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  vehicle: string | null
}

export interface SeedResult {
  summary: { users: number }
  users: SeedUserSummary[]
}

@Injectable()
export class SeedService {
  constructor(private readonly userService: UserService) {}

  async seed(branches: SeedBranch[] = []): Promise<SeedResult> {
    const users: PublicUser[] = []
    const branchByName = new Map(
      branches.map((branch) => [normalizeBranchName(branch.name), branch.id]),
    )

    for (const seed of this.loadData().users) {
      const password = passwordFor(seed)

      if (!password) {
        Logger.warn(`usuario de seed sin contraseña configurada: ${seed.key}`, 'Seed')
        continue
      }

      let branchId: string | null = null

      if (seed.role === 'branch_admin') {
        if (!seed.branchName) continue
        branchId = branchByName.get(normalizeBranchName(seed.branchName)) ?? null
        if (!branchId) {
          Logger.warn(`sucursal no encontrada para el admin de seed: ${seed.branchName}`, 'Seed')
          continue
        }
      }

      users.push(
        await this.ensureUser({
          email: seed.email,
          password,
          role: seed.role,
          firstName: seed.firstName,
          lastName: seed.lastName,
          phone: seed.phone,
          branchId,
          vehicle: seed.vehicle ?? null,
        }),
      )
    }

    return {
      summary: { users: users.length },
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        vehicle: user.vehicle,
      })),
    }
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
