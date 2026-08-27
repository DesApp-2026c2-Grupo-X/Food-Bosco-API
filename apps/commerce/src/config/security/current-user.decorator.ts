import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthContext } from './jwt.service'

const anonymous = (): AuthContext => ({
  authenticated: false,
  userId: null,
  roles: [],
  branchId: null,
  internal: false,
})

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<{ user?: AuthContext }>()
    return request.user ?? anonymous()
  },
)
