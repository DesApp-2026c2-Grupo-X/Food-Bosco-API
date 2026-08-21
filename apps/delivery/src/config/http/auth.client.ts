import { Injectable } from '@nestjs/common'
import { HEADERS } from '../constants'
import { env } from '../env'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  phone: string
  vehicle: string | null
  role: string
}

@Injectable()
export class AuthClient {
  async getUser(userId: string): Promise<AuthUser | null> {
    const response = await fetch(`${env.authServiceUrl}/v1/users/${userId}`, {
      headers: {
        accept: 'application/json',
        [HEADERS.internalToken]: env.internalApiToken,
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`Auth devolvió HTTP ${response.status}`)
    }

    return (await response.json()) as AuthUser
  }
}
