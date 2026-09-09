import { Module } from '@nestjs/common'
import { env } from '../config/env'
import { RestClient } from './rest.client'

export const AUTH_REST_CLIENT = Symbol('AUTH_REST_CLIENT')
export const COMMERCE_REST_CLIENT = Symbol('COMMERCE_REST_CLIENT')
export const DELIVERY_REST_CLIENT = Symbol('DELIVERY_REST_CLIENT')

@Module({
  providers: [
    {
      provide: AUTH_REST_CLIENT,
      useFactory: (): RestClient => new RestClient('auth', env.services.auth),
    },
    {
      provide: COMMERCE_REST_CLIENT,
      useFactory: (): RestClient => new RestClient('commerce', env.services.commerce),
    },
    {
      provide: DELIVERY_REST_CLIENT,
      useFactory: (): RestClient => new RestClient('delivery', env.services.delivery),
    },
  ],
  exports: [AUTH_REST_CLIENT, COMMERCE_REST_CLIENT, DELIVERY_REST_CLIENT],
})
export class RestModule {}
