import { Injectable, Logger } from '@nestjs/common'
import { ROLES, Role } from '../config/constants'
import { env } from '../config/env'
import { UserService, type PublicUser } from '../user/user.service'

interface SeedUser {
  email: string
  password: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  branchId?: string | null
  vehicle?: string | null
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

export interface SeedResult {
  summary: { users: number }
  users: SeedUserSummary[]
}

@Injectable()
export class SeedService {
  constructor(private readonly userService: UserService) {}

  async seed(branchId?: string): Promise<SeedResult> {
    const users: PublicUser[] = []

    users.push(
      await this.ensureUser({
        email: env.seed.superAdminEmail,
        password: env.seed.superAdminPassword,
        role: ROLES.superAdmin,
        firstName: env.seed.superAdminFirstName,
        lastName: env.seed.superAdminLastName,
        phone: env.seed.superAdminPhone,
      }),
    )

    users.push(
      await this.ensureUser({
        email: env.seed.customerEmail,
        password: env.seed.customerPassword,
        role: ROLES.customer,
        firstName: env.seed.customerFirstName,
        lastName: env.seed.customerLastName,
        phone: env.seed.customerPhone,
      }),
    )

    users.push(
      await this.ensureUser({
        email: env.seed.riderEmail,
        password: env.seed.riderPassword,
        role: ROLES.rider,
        firstName: env.seed.riderFirstName,
        lastName: env.seed.riderLastName,
        phone: env.seed.riderPhone,
        vehicle: env.seed.riderVehicle,
      }),
    )

    if (branchId) {
      users.push(
        await this.ensureUser({
          email: env.seed.branchAdminEmail,
          password: env.seed.branchAdminPassword,
          role: ROLES.branchAdmin,
          firstName: env.seed.branchAdminFirstName,
          lastName: env.seed.branchAdminLastName,
          phone: env.seed.branchAdminPhone,
          branchId,
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

  private async ensureUser(input: SeedUser): Promise<PublicUser> {
    const existing = await this.userService.findByEmail(input.email)
    if (existing) {
      return existing
    }

    const created = await this.userService.createUser({
      email: input.email,
      password: input.password,
      role: input.role,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      branchId: input.branchId ?? null,
      vehicle: input.vehicle ?? null,
    })

    Logger.log(`usuario creado: ${created.email} (${created.role})`, 'Seed')
    return created
  }
}
