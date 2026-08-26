import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { SecurityModule } from '../security/security.module'
import { JwtService } from '../security/jwt.service'
import { env } from '../config/env'
import { buildContext } from './gateway.context'
import { formatGraphQLError } from '../observability/graphql-error-formatter'
import { RestModule } from '../rest/rest.module'
import { GatewayResolver } from './gateway.resolver'

@Module({
  imports: [
    RestModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [SecurityModule],
      inject: [JwtService],
      useFactory: (jwtService: JwtService): ApolloDriverConfig => ({
        autoSchemaFile: true,
        sortSchema: true,
        context: buildContext(jwtService),
        formatError: formatGraphQLError,
        introspection: env.nodeEnv !== 'production',
        playground: env.nodeEnv !== 'production',
      }),
    }),
  ],
  providers: [GatewayResolver],
})
export class GatewayModule {}
