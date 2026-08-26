import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { Role } from '../common/role.enum'
import { AuthResolver } from './auth.resolver'

const ctx = {
  authenticated: true,
  userId: 'u1',
  roles: ['customer'],
  branchId: null,
  requestId: 'rid-1',
  authorization: 'Bearer xyz',
} as unknown as GraphQLContext

const rawUser = {
  id: 'u1',
  email: 'cliente@example.com',
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
  role: 'customer',
  active: true,
  branchId: null,
  vehicle: null,
}

const rawAddress = {
  id: 'a1',
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
  active: true,
}

describe('AuthResolver — mutaciones públicas', () => {
  const rest = { post: jest.fn() }
  const resolver = new AuthResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('register → POST /v1/auth/register', async () => {
    rest.post.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' })
    const input = { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '1', password: 'p' }

    const result = await resolver.register(input)

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/register', { body: input })
    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt' })
  })

  it('registerRider → POST /v1/auth/register-rider', async () => {
    rest.post.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' })
    const input = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '1',
      password: 'p',
      vehicle: 'Moto',
    }

    await resolver.registerRider(input)

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/register-rider', { body: input })
  })

  it('login → POST /v1/auth/login', async () => {
    rest.post.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' })
    const input = { email: 'a@b.com', password: 'p' }

    await resolver.login(input)

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/login', { body: input })
  })

  it('refreshToken → POST /v1/auth/refresh', async () => {
    rest.post.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' })

    await resolver.refreshToken('refresh-viejo')

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/refresh', {
      body: { refreshToken: 'refresh-viejo' },
    })
  })

  it('requestPasswordRecovery → POST /v1/auth/password-recovery', async () => {
    await resolver.requestPasswordRecovery('a@b.com')

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/password-recovery', {
      body: { email: 'a@b.com' },
    })
  })

  it('resetPassword → POST /v1/auth/reset-password', async () => {
    await resolver.resetPassword('token-123', 'nueva-clave')

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/reset-password', {
      body: { token: 'token-123', newPassword: 'nueva-clave' },
    })
  })
})

describe('AuthResolver — operaciones autenticadas', () => {
  const rest = { post: jest.fn(), get: jest.fn(), patch: jest.fn() }
  const resolver = new AuthResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('logout → POST /v1/auth/logout con contexto', async () => {
    rest.post.mockResolvedValue({ ok: true })

    const result = await resolver.logout(ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/auth/logout', {
      context: expect.objectContaining({ userId: 'u1', authorization: 'Bearer xyz' }),
    })
    expect(result).toBe(true)
  })

  it('me → GET /v1/me y mapea el usuario', async () => {
    rest.get.mockResolvedValue(rawUser)

    const result = await resolver.me(ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/me', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('u1')
    expect(result.role).toBe(Role.CUSTOMER)
  })

  it('updateProfile → PATCH /v1/me y mapea el usuario', async () => {
    rest.patch.mockResolvedValue({ ...rawUser, firstName: 'Pedro' })
    const input = { firstName: 'Pedro', lastName: 'Perez', phone: '11223344' }

    const result = await resolver.updateProfile(input, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/me', {
      body: input,
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.firstName).toBe('Pedro')
  })
})

describe('AuthResolver — usuarios (super_admin)', () => {
  const rest = { get: jest.fn(), post: jest.fn(), patch: jest.fn() }
  const resolver = new AuthResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('users → GET /v1/users con filtros mapeados y pageInfo', async () => {
    rest.get.mockResolvedValue({ data: [rawUser], meta: { total: 1, limit: 5, offset: 10 } })

    const result = await resolver.users(
      { role: Role.SUPER_ADMIN, active: true, search: 'juan' },
      { limit: 5, offset: 10 },
      ctx,
    )

    expect(rest.get).toHaveBeenCalledWith('/v1/users', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { role: 'super_admin', active: true, search: 'juan', limit: 5, offset: 10 },
    })
    expect(result.pageInfo).toEqual({ total: 1, limit: 5, offset: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].role).toBe(Role.CUSTOMER)
  })

  it('users → tolera filtro y página ausentes', async () => {
    rest.get.mockResolvedValue({ data: [], meta: { total: 0, limit: 20, offset: 0 } })

    await resolver.users(null, null, ctx)

    expect(rest.get).toHaveBeenCalledWith(
      '/v1/users',
      expect.objectContaining({
        query: {
          role: undefined,
          active: undefined,
          search: undefined,
          limit: undefined,
          offset: undefined,
        },
      }),
    )
  })

  it('user → GET /v1/users/{id} con fallback a _id y rol mapeado', async () => {
    rest.get.mockResolvedValue({
      _id: 'u9',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      role: 'super_admin',
      active: true,
      branchId: 'b1',
      vehicle: null,
    })

    const result = await resolver.user('u9', ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/users/u9', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('u9')
    expect(result.role).toBe(Role.SUPER_ADMIN)
    expect(result.branchId).toBe('b1')
  })

  it.each([
    {
      name: 'createStaff',
      path: '/v1/users/staff',
      call: (r: AuthResolver) =>
        r.createStaff(
          {
            firstName: 'A',
            lastName: 'B',
            email: 'a@b.com',
            phone: '1',
            password: 'p',
            branchId: 'b1',
          },
          ctx,
        ),
    },
    {
      name: 'createAdmin',
      path: '/v1/users/admins',
      call: (r: AuthResolver) =>
        r.createAdmin(
          { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '1', password: 'p' },
          ctx,
        ),
    },
    {
      name: 'createRider',
      path: '/v1/users/riders',
      call: (r: AuthResolver) =>
        r.createRider(
          {
            firstName: 'A',
            lastName: 'B',
            email: 'a@b.com',
            phone: '1',
            password: 'p',
            vehicle: 'Moto',
          },
          ctx,
        ),
    },
  ])('$name → POST $path', async ({ path, call }) => {
    rest.post.mockResolvedValue(rawUser)

    const result = await call(resolver)

    expect(rest.post).toHaveBeenCalledWith(path, {
      body: expect.any(Object),
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('u1')
  })

  it('updateUser → PATCH /v1/users/{id}', async () => {
    rest.patch.mockResolvedValue({ ...rawUser, branchId: 'b2' })
    const input = { branchId: 'b2' }

    const result = await resolver.updateUser('u1', input, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/users/u1', {
      body: input,
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.branchId).toBe('b2')
  })

  it('setUserActive → PATCH /v1/users/{id}/active', async () => {
    rest.patch.mockResolvedValue({ ...rawUser, active: false })

    const result = await resolver.setUserActive('u1', false, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/users/u1/active', {
      body: { active: false },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.active).toBe(false)
  })
})

describe('AuthResolver — direcciones (customer)', () => {
  const rest = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }
  const resolver = new AuthResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('myAddresses → GET /v1/addresses y mapea data', async () => {
    rest.get.mockResolvedValue({ data: [rawAddress] })

    const result = await resolver.myAddresses(ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/addresses', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
    expect(result[0].label).toBe('Casa')
  })

  it('address → GET /v1/addresses/{id}', async () => {
    rest.get.mockResolvedValue(rawAddress)

    const result = await resolver.address('a1', ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/addresses/a1', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('a1')
  })

  it('createAddress → POST /v1/addresses', async () => {
    rest.post.mockResolvedValue(rawAddress)
    const input = { label: 'Casa', text: 'Av. Siempre Viva 123', latitude: -34.6, longitude: -58.4 }

    await resolver.createAddress(input, ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/addresses', {
      body: input,
      context: expect.objectContaining({ userId: 'u1' }),
    })
  })

  it('updateAddress → PATCH /v1/addresses/{id}', async () => {
    rest.patch.mockResolvedValue({ ...rawAddress, label: 'Trabajo' })

    const result = await resolver.updateAddress('a1', { label: 'Trabajo' }, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/addresses/a1', {
      body: { label: 'Trabajo' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.label).toBe('Trabajo')
  })

  it('deleteAddress → DELETE /v1/addresses/{id}', async () => {
    rest.delete.mockResolvedValue({ ok: true })

    const result = await resolver.deleteAddress('a1', ctx)

    expect(rest.delete).toHaveBeenCalledWith('/v1/addresses/a1', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result).toBe(true)
  })
})
