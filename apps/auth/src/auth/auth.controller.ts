import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { Authenticated } from '../config/security/authenticated.decorator'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { LoginDto } from '../user/dto/login.dto'
import { RegisterDto } from '../user/dto/register.dto'
import { RegisterRiderDto } from '../user/dto/register-rider.dto'
import { AuthOrchestrator } from './auth.orchestrator'
import type { AuthTokensResponse } from './auth.orchestrator'
import { RefreshDto } from './dto/refresh.dto'
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'

interface NeutralResponse {
  ok: boolean
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly orchestrator: AuthOrchestrator) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthTokensResponse> {
    return this.orchestrator.register(dto)
  }

  @Post('register-rider')
  registerRider(@Body() dto: RegisterRiderDto): Promise<AuthTokensResponse> {
    return this.orchestrator.registerRider(dto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokensResponse> {
    return this.orchestrator.login(dto)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensResponse> {
    return this.orchestrator.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  async logout(@CurrentUser() auth: AuthContext): Promise<NeutralResponse> {
    if (auth.userId) {
      await this.orchestrator.logout(auth.userId)
    }
    return { ok: true }
  }

  @Post('password-recovery')
  @HttpCode(HttpStatus.OK)
  async requestPasswordRecovery(@Body() dto: RequestPasswordRecoveryDto): Promise<NeutralResponse> {
    await this.orchestrator.requestPasswordRecovery(dto.email)
    return { ok: true }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<NeutralResponse> {
    await this.orchestrator.resetPassword(dto.token, dto.newPassword)
    return { ok: true }
  }
}
