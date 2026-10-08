import { Injectable } from '@nestjs/common'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Role } from '../constants'
import { env } from '../env'

export interface AuthContext {
  authenticated: boolean
  userId: string | null
  roles: Role[]
  branchId: string | null
  internal: boolean
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
  internal: false,
})

@Injectable()
export class JwtService {
  verify(token: string | undefined): AuthContext {
    const bearerToken = token?.replace(/^Bearer\s+/i, '').trim()

    if (!bearerToken) {
      return anonymous()
    }

    try {
      const payload = jwt.verify(bearerToken, env.jwtSecret) as TokenPayload
      const userId = payload.userId ?? payload.sub ?? null

      if (!userId) {
        return anonymous()
      }

      return {
        authenticated: true,
        userId,
        roles: payload.roles ?? [],
        branchId: payload.branchId ?? null,
        internal: false,
      }
    } catch {
      return anonymous()
    }
  }
}
