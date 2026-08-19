import { Injectable } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { JwtService } from '../config/security/jwt.service'
import { PasswordRecoveryService } from '../password-recovery/password-recovery.service'
import { RefreshTokenService } from '../refresh-token/refresh-token.service'
import { CreateUserInput, PublicUser, UserService } from '../user/user.service'
import { LoginDto } from '../user/dto/login.dto'
import { RegisterDto } from '../user/dto/register.dto'
import { RegisterRiderDto } from '../user/dto/register-rider.dto'

export interface AuthTokensResponse {
  accessToken: string
  refreshToken: string
}

@Injectable()
export class AuthOrchestrator {
  constructor(
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto): Promise<AuthTokensResponse> {
    const user = await this.userService.createUser(this.toCreateInput(input, ROLES.customer))
    return this.issueTokens(user)
  }

  async registerRider(input: RegisterRiderDto): Promise<AuthTokensResponse> {
    const user = await this.userService.createUser({ ...this.toCreateInput(input, ROLES.rider), vehicle: input.vehicle })
    return this.issueTokens(user)
  }

  async login(input: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.userService.verifyCredentials(input.email, input.password)
    return this.issueTokens(user)
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const { userId, refreshToken: newRefreshToken } = await this.refreshTokenService.rotate(refreshToken)
    const user = await this.userService.findById(userId)

    if (!user || !user.active) {
      throw new DomainException(ERROR_CODES.invalidRefreshToken, 'Refresh token inválido', 401)
    }

    const accessToken = this.jwtService.signAccessToken({
      id: user.id,
      role: user.role,
      branchId: user.branchId,
    })

    return { accessToken, refreshToken: newRefreshToken }
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAll(userId)
  }

  async requestPasswordRecovery(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email)
    if (user) {
      await this.passwordRecoveryService.create(user.id)
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.passwordRecoveryService.consume(token)
    await this.userService.setPassword(userId, newPassword)
    await this.refreshTokenService.revokeAll(userId)
  }

  private async issueTokens(user: PublicUser): Promise<AuthTokensResponse> {
    const accessToken = this.jwtService.signAccessToken({
      id: user.id,
      role: user.role,
      branchId: user.branchId,
    })
    const refreshToken = await this.refreshTokenService.issue(user.id)
    return { accessToken, refreshToken }
  }

  private toCreateInput(
    input: RegisterDto | RegisterRiderDto,
    role: CreateUserInput['role'],
  ): CreateUserInput {
    return {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      password: input.password,
      role,
    }
  }
}
