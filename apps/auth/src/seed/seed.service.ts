import { Injectable, Logger } from '@nestjs/common'
import { ROLES } from '../config/constants'
import { env } from '../config/env'
import { UserService } from '../user/user.service'

@Injectable()
export class SeedService {
  constructor(private readonly userService: UserService) {}

  async seedSuperAdmin(): Promise<void> {
    const email = env.seed.superAdminEmail
    const existing = await this.userService.findByEmail(email)

    if (existing) {
      Logger.log(`super_admin ya existe: ${email}`, 'Seed')
      return
    }

    await this.userService.createUser({
      email,
      password: env.seed.superAdminPassword,
      role: ROLES.superAdmin,
      firstName: env.seed.superAdminFirstName,
      lastName: env.seed.superAdminLastName,
      phone: env.seed.superAdminPhone,
    })

    Logger.log(`super_admin creado: ${email}`, 'Seed')
  }
}
