import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { hash } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { createMongoServer } from './mongo'
import { AuthModule } from '../src/auth/auth.module'
import { sha256 } from '../src/config/crypto'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { CommerceClient } from '../src/config/http/commerce.client'
import { SecurityModule } from '../src/config/security/security.module'
import { EMAIL_PROVIDER } from '../src/email/email.model'
import { PasswordRecoveryModule } from '../src/password-recovery/password-recovery.module'
import { RefreshTokenModule } from '../src/refresh-token/refresh-token.module'
import { UserModule } from '../src/user/user.module'

interface UserRow {
  email: string
  passwordHash: string
  role: string
  firstName: string
  lastName: string
  phone: string
  active: boolean
  branchId: string | null
  vehicle: string | null
}

interface RefreshRow {
  userId: string
  tokenHash: string
  expiresAt: Date
  revoked: boolean
}

interface RecoveryRow {
  userId: string
  tokenHash: string
  expiresAt: Date
  used: boolean
}

const validRegister = {
  firstName: 'Juan',
  lastName: 'Perez',
  email: 'base@test.com',
  phone: '11223344',
  password: 'password123',
}

describe('Auth flows (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<UserRow>
  let refreshModel: Model<RefreshRow>
  let recoveryModel: Model<RecoveryRow>

  let adminToken = ''
  let branchAdminToken = ''

  const register = (overrides: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        ...validRegister,
        email: `user-${Date.now()}-${Math.random()}@test.com`,
        ...overrides,
      })

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/v1/auth/login').send({ email, password })

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        UserModule,
        AuthModule,
        RefreshTokenModule,
        PasswordRecoveryModule,
      ],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue({ send: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(CommerceClient)
      .useValue({ branchExists: jest.fn().mockResolvedValue(true) })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    await app.listen(0)

    userModel = app.get<Model<UserRow>>(getModelToken('User'))
    refreshModel = app.get<Model<RefreshRow>>(getModelToken('RefreshToken'))
    recoveryModel = app.get<Model<RecoveryRow>>(getModelToken('PasswordRecovery'))

    await userModel.create({
      email: 'admin@test.com',
      passwordHash: await hash('admin-pass', 10),
      role: 'super_admin',
      firstName: 'Admin',
      lastName: 'Test',
      phone: '000',
      active: true,
      branchId: null,
      vehicle: null,
    })

    const adminLogin = await login('admin@test.com', 'admin-pass').expect(200)
    adminToken = adminLogin.body.accessToken as string

    await request(app.getHttpServer())
      .post('/v1/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Branch',
        lastName: 'Admin',
        email: 'branch@test.com',
        phone: '1',
        password: 'password123',
        branchId: 'branch-1',
      })
      .expect(201)

    const branchLogin = await login('branch@test.com', 'password123').expect(200)
    branchAdminToken = branchLogin.body.accessToken as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('register (/v1/auth/register)', () => {
    it.each([
      { name: 'password de 7 caracteres', body: { password: '1234567' } },
      { name: 'password de 129 caracteres', body: { password: 'a'.repeat(129) } },
      { name: 'email malformado', body: { email: 'no-es-email' } },
      { name: 'firstName demasiado largo', body: { firstName: 'a'.repeat(101) } },
      { name: 'lastName demasiado largo', body: { lastName: 'a'.repeat(101) } },
      { name: 'phone demasiado largo', body: { phone: 'a'.repeat(51) } },
    ])('rechaza $name con 400', async ({ body }) => {
      const res = await register(body).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza un body vacío con 400', async () => {
      const res = await request(app.getHttpServer()).post('/v1/auth/register').send({}).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('fuerza el rol customer ignorando un rol enviado', async () => {
      const res = await register({ role: 'super_admin' }).expect(201)
      const payload = jwt.decode(res.body.accessToken as string) as jwt.JwtPayload
      expect(payload.roles).toEqual(['customer'])
    })
  })

  describe('login (/v1/auth/login)', () => {
    it('rechaza un usuario inactivo con 403 USER_INACTIVE', async () => {
      await register({ email: 'inactive@test.com' }).expect(201)
      await userModel.updateOne({ email: 'inactive@test.com' }, { $set: { active: false } })

      const res = await login('inactive@test.com', 'password123').expect(403)
      expect(res.body.code).toBe('USER_INACTIVE')
    })

    it.each([
      { name: 'email inválido', body: { email: 'no-es-email', password: 'password123' } },
      { name: 'body vacío', body: {} },
    ])('rechaza $name con 400', async ({ body }) => {
      const res = await request(app.getHttpServer()).post('/v1/auth/login').send(body).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('refresh (/v1/auth/refresh)', () => {
    it.each([
      { name: 'token ausente', body: {} },
      { name: 'token vacío', body: { refreshToken: '' } },
    ])('rechaza $name con 400', async ({ body }) => {
      const res = await request(app.getHttpServer()).post('/v1/auth/refresh').send(body).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza un refresh token expirado con 401', async () => {
      const reg = await register({ email: 'expired-refresh@test.com' }).expect(201)
      const userId = (jwt.decode(reg.body.accessToken as string) as jwt.JwtPayload).userId as string

      await refreshModel.create({
        userId,
        tokenHash: sha256('expired-refresh-token'),
        expiresAt: new Date(Date.now() - 60_000),
        revoked: false,
      })

      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'expired-refresh-token' })
        .expect(401)

      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
    })

    it('rechaza el refresh de un usuario inactivo con 401', async () => {
      const reg = await register({ email: 'inactive-refresh@test.com' }).expect(201)
      const userId = (jwt.decode(reg.body.accessToken as string) as jwt.JwtPayload).userId as string
      const loginRes = await login('inactive-refresh@test.com', 'password123').expect(200)

      await userModel.updateOne({ _id: userId }, { $set: { active: false } })

      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401)

      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
    })
  })

  describe('logout (/v1/auth/logout)', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).post('/v1/auth/logout').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('cierra sesión y devuelve { ok: true }', async () => {
      const reg = await register({ email: 'logout@test.com' }).expect(201)

      const res = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .expect(200)

      expect(res.body).toEqual({ ok: true })
    })
  })

  describe('password-recovery (/v1/auth/password-recovery)', () => {
    it('rechaza un email inválido con 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/password-recovery')
        .send({ email: 'no-es-email' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('reset-password (/v1/auth/reset-password)', () => {
    it('rechaza un token expirado con 400', async () => {
      const reg = await register({ email: 'expired-reset@test.com' }).expect(201)
      const userId = (jwt.decode(reg.body.accessToken as string) as jwt.JwtPayload).userId as string

      await recoveryModel.create({
        userId,
        tokenHash: sha256('expired-reset-token'),
        expiresAt: new Date(Date.now() - 60_000),
        used: false,
      })

      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'expired-reset-token', newPassword: 'newpassword123' })
        .expect(400)

      expect(res.body.code).toBe('INVALID_OR_EXPIRED_TOKEN')
    })

    it('rechaza una password fuera de rango con 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'cualquiera', newPassword: '1234567' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('revoca los refresh tokens previos al restablecer', async () => {
      await register({ email: 'reset-revoke@test.com' }).expect(201)
      const loginRes = await login('reset-revoke@test.com', 'password123').expect(200)
      const userId = (jwt.decode(loginRes.body.accessToken as string) as jwt.JwtPayload)
        .userId as string

      await recoveryModel.create({
        userId,
        tokenHash: sha256('valid-reset-token'),
        expiresAt: new Date(Date.now() + 60_000),
        used: false,
      })

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'valid-reset-token', newPassword: 'newpassword123' })
        .expect(200)

      const refresh = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401)

      expect(refresh.body.code).toBe('INVALID_REFRESH_TOKEN')

      await login('reset-revoke@test.com', 'newpassword123').expect(200)
    })
  })

  describe('register-rider (/v1/auth/register-rider)', () => {
    const riderBody = {
      firstName: 'Raul',
      lastName: 'Rider',
      email: 'rider-dup@test.com',
      phone: '1',
      password: 'password123',
      vehicle: 'Moto',
    }

    it('rechaza email duplicado con 409', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register-rider')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(riderBody)
        .expect(201)

      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-rider')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(riderBody)
        .expect(409)

      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('rechaza payload inválido con 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-rider')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Sin',
          lastName: 'Vehiculo',
          email: 'no-vehicle-rider@test.com',
          phone: '1',
          password: 'password123',
        })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza a un branch_admin con 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-rider')
        .set('Authorization', `Bearer ${branchAdminToken}`)
        .send({ ...riderBody, email: 'rider-by-branch@test.com' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
