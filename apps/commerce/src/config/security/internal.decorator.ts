import { SetMetadata } from '@nestjs/common'

export const INTERNAL_KEY = 'internal'

export const Internal = (): MethodDecorator & ClassDecorator => SetMetadata(INTERNAL_KEY, true)
