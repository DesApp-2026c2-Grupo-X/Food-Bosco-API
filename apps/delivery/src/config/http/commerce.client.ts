import { Injectable } from '@nestjs/common'
import { HEADERS } from '../constants'
import { env } from '../env'

@Injectable()
export class CommerceClient {
  async patchOrderStatus(orderId: string, status: string): Promise<void> {
    const response = await fetch(`${env.commerceServiceUrl}/v1/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        [HEADERS.internalToken]: env.internalApiToken,
      },
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      throw new Error(`Commerce devolvió HTTP ${response.status}`)
    }
  }
}
