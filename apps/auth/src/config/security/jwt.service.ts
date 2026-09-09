import { Injectable } from '@nestjs/common'
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import { Role } from '../constants'
import { env } from '../env'

export interface AuthContext {
  authenticated: boolean
  userId: string | null
  roles: Role[]
  branchId: string | null
}

export interface TokenUser {
  id: string
  role: Role
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
  signAccessToken(user: TokenUser): string {
    return jwt.sign(
      { sub: user.id, userId: user.id, roles: [user.role], branchId: user.branchId ?? null },
      env.jwtSecret,
      { expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'] },
    )
  }

  verify(token: string | undefined): AuthContext {
    const bearerToken = token?.replace(/^Bearer\s+/i, '').trim()

    if (!bearerToken) {
      return anonymous()
    }

    try {
      const payload = jwt.verify(bearerToken, env.jwtSecret) as TokenPayload

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
