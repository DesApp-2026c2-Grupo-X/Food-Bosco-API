import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { SecurityModule } from '../security/security.module'
import { JwtService } from '../security/jwt.service'
import { env } from '../config/env'
import { buildContext } from './gateway.context'
import { formatGraphQLError } from '../observability/graphql-error-formatter'
import { RestModule } from '../rest/rest.module'
import { AuthGraphqlModule } from '../graphql/auth/auth.module'
import { DeliveryGraphqlModule } from '../graphql/delivery/delivery.module'
import { CommerceGraphqlModule } from '../graphql/commerce/commerce.module'

@Module({
  imports: [
    RestModule,
    AuthGraphqlModule,
    DeliveryGraphqlModule,
    CommerceGraphqlModule,
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
})
export class GatewayModule {}
