import { Query, Resolver } from '@nestjs/graphql'

@Resolver()
export class GatewayResolver {
  @Query(() => String)
  ping(): string {
    return 'pong'
  }
}
