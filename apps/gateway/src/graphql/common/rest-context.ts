import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestContext } from '../../rest/rest.client'

export const toRestContext = (ctx: GraphQLContext): RestContext => ({
  authorization: ctx.authorization,
  userId: ctx.userId,
  roles: ctx.roles,
  branchId: ctx.branchId,
  requestId: ctx.requestId,
})
