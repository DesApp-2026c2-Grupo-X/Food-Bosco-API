import { SetMetadata } from '@nestjs/common'

export const AUTHENTICATED_KEY = 'authenticated'

export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_KEY, true)
