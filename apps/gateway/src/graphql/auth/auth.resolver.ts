import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { ROLES } from '../../config/constants'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { AUTH_REST_CLIENT } from '../../rest/rest.module'
import { Authenticated } from '../../security/authenticated.decorator'
import { AuthGuard } from '../../security/auth.guard'
import { Roles } from '../../security/roles.decorator'
import { PageInput } from '../common/page'
import { toRestContext } from '../common/rest-context'
import { roleToRest } from '../common/role.enum'
import {
  CreateAddressInput,
  CreateAdminInput,
  CreateRiderInput,
  CreateStaffInput,
  LoginInput,
  RegisterInput,
  RegisterRiderInput,
  UpdateAddressInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserFilterInput,
} from './auth.inputs'
import {
  Address,
  AuthTokens,
  User,
  UserPage,
  mapAddress,
  mapUser,
} from './auth.types'

type RawRecord = Record<string, unknown>

interface UserListRest {
  data: RawRecord[]
  meta: { total: number; limit: number; offset: number }
}

interface AddressListRest {
  data: RawRecord[]
}

@Resolver()
@UseGuards(AuthGuard)
export class AuthResolver {
  constructor(@Inject(AUTH_REST_CLIENT) private readonly rest: RestClient) {}

  @Mutation(() => AuthTokens)
  register(@Args('input') input: RegisterInput): Promise<AuthTokens> {
    return this.rest.post('/v1/auth/register', { body: input })
  }

  @Mutation(() => AuthTokens)
  registerRider(@Args('input') input: RegisterRiderInput): Promise<AuthTokens> {
    return this.rest.post('/v1/auth/register-rider', { body: input })
  }

  @Mutation(() => AuthTokens)
  login(@Args('input') input: LoginInput): Promise<AuthTokens> {
    return this.rest.post('/v1/auth/login', { body: input })
  }

  @Mutation(() => AuthTokens)
  refreshToken(@Args('refreshToken') refreshToken: string): Promise<AuthTokens> {
    return this.rest.post('/v1/auth/refresh', { body: { refreshToken } })
  }

  @Mutation(() => Boolean)
  @Authenticated()
  async logout(@Context() ctx: GraphQLContext): Promise<boolean> {
    await this.rest.post('/v1/auth/logout', { context: toRestContext(ctx) })
    return true
  }

  @Mutation(() => Boolean)
  async requestPasswordRecovery(@Args('email') email: string): Promise<boolean> {
    await this.rest.post('/v1/auth/password-recovery', { body: { email } })
    return true
  }

  @Mutation(() => Boolean)
  async resetPassword(@Args('token') token: string, @Args('newPassword') newPassword: string): Promise<boolean> {
    await this.rest.post('/v1/auth/reset-password', { body: { token, newPassword } })
    return true
  }

  @Query(() => User)
  @Authenticated()
  async me(@Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.get<RawRecord>('/v1/me', { context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Authenticated()
  async updateProfile(@Args('input') input: UpdateProfileInput, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.patch<RawRecord>('/v1/me', { body: input, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Query(() => UserPage)
  @Roles(ROLES.superAdmin)
  async users(
    @Args('filter', { type: () => UserFilterInput, nullable: true }) filter: UserFilterInput | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<UserPage> {
    const raw = await this.rest.get<UserListRest>('/v1/users', {
      context: toRestContext(ctx),
      query: {
        role: filter?.role ? roleToRest(filter.role) : undefined,
        active: filter?.active,
        search: filter?.search,
        limit: page?.limit,
        offset: page?.offset,
      },
    })

    return {
      data: raw.data.map(mapUser),
      pageInfo: { total: raw.meta.total, limit: raw.meta.limit, offset: raw.meta.offset },
    }
  }

  @Query(() => User)
  @Roles(ROLES.superAdmin)
  async user(@Args('id') id: string, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.get<RawRecord>(`/v1/users/${id}`, { context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Roles(ROLES.superAdmin)
  async createStaff(@Args('input') input: CreateStaffInput, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.post<RawRecord>('/v1/users/staff', { body: input, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Roles(ROLES.superAdmin)
  async createAdmin(@Args('input') input: CreateAdminInput, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.post<RawRecord>('/v1/users/admins', { body: input, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Roles(ROLES.superAdmin)
  async createRider(@Args('input') input: CreateRiderInput, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.post<RawRecord>('/v1/users/riders', { body: input, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Roles(ROLES.superAdmin)
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInput,
    @Context() ctx: GraphQLContext,
  ): Promise<User> {
    const raw = await this.rest.patch<RawRecord>(`/v1/users/${id}`, { body: input, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Mutation(() => User)
  @Roles(ROLES.superAdmin)
  async setUserActive(@Args('id') id: string, @Args('active') active: boolean, @Context() ctx: GraphQLContext): Promise<User> {
    const raw = await this.rest.patch<RawRecord>(`/v1/users/${id}/active`, { body: { active }, context: toRestContext(ctx) })
    return mapUser(raw)
  }

  @Query(() => [Address])
  @Roles(ROLES.customer)
  async myAddresses(@Context() ctx: GraphQLContext): Promise<Address[]> {
    const raw = await this.rest.get<AddressListRest>('/v1/addresses', { context: toRestContext(ctx) })
    return raw.data.map(mapAddress)
  }

  @Query(() => Address)
  @Roles(ROLES.customer)
  async address(@Args('id') id: string, @Context() ctx: GraphQLContext): Promise<Address> {
    const raw = await this.rest.get<RawRecord>(`/v1/addresses/${id}`, { context: toRestContext(ctx) })
    return mapAddress(raw)
  }

  @Mutation(() => Address)
  @Roles(ROLES.customer)
  async createAddress(@Args('input') input: CreateAddressInput, @Context() ctx: GraphQLContext): Promise<Address> {
    const raw = await this.rest.post<RawRecord>('/v1/addresses', { body: input, context: toRestContext(ctx) })
    return mapAddress(raw)
  }

  @Mutation(() => Address)
  @Roles(ROLES.customer)
  async updateAddress(
    @Args('id') id: string,
    @Args('input') input: UpdateAddressInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Address> {
    const raw = await this.rest.patch<RawRecord>(`/v1/addresses/${id}`, { body: input, context: toRestContext(ctx) })
    return mapAddress(raw)
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.customer)
  async deleteAddress(@Args('id') id: string, @Context() ctx: GraphQLContext): Promise<boolean> {
    await this.rest.delete(`/v1/addresses/${id}`, { context: toRestContext(ctx) })
    return true
  }
}
