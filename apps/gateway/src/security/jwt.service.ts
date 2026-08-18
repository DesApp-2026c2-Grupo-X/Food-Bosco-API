import { Injectable } from '@nestjs/common'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env'
import { Role } from '../config/constants'

export interface AuthContext {
  authenticated: boolean
  userId: string | null
  roles: Role[]
  branchId: string | null
}

type TokenPayload = JwtPayload & {
  userId?: string
  roles?: Role[]
  branchId?: string
}

const anonymous = (): AuthContext => ({
  authenticated: false,
  userId: null,
  roles: [],
  branchId: null,
})

@Injectable()
export class JwtService {
  private readonly secret = env.jwtSecret

  verify(token: string | undefined): AuthContext {
    const bearerToken = token?.replace(/^Bearer\s+/i, '').trim()

    if (!bearerToken) {
      return anonymous()
    }

    try {
      const payload = jwt.verify(bearerToken, this.secret) as TokenPayload

      return {
        authenticated: true,
        userId: payload.userId ?? payload.sub ?? null,
        roles: payload.roles ?? [],
        branchId: payload.branchId ?? null,
      }
    } catch {
      return anonymous()
    }
  }
}
