import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { hash } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { createMongoServer } from './mongo'
import { AddressModule } from '../src/address/address.module'
import { AuthModule } from '../src/auth/auth.module'
import { env } from '../src/config/env'
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
  branchId?: string | null
  vehicle?: string | null
}

interface RecoveryRow {
  userId: string
  tokenHash: string
  expiresAt: Date
  used: boolean
}

const validProfile = { firstName: 'Pedro', lastName: 'Gomez', phone: '999' }

const validAddress = {
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  latitude: -34.6,
  longitude: -58.4,
}

const forbiddenRoles = ['customer', 'branch_admin', 'rider']

describe('Authorization (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<UserRow>
  let recoveryModel: Model<RecoveryRow>

  const emailSend = jest.fn().mockResolvedValue(undefined)
  const branchExists = jest.fn().mockResolvedValue(true)

  const tokens: Record<string, string> = { customer: '', branch_admin: '', rider: '' }
  let customerId = ''
  let adminToken = ''
  let editableTargetId = ''

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
        AddressModule,
      ],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue({ send: emailSend })
      .overrideProvider(CommerceClient)
      .useValue({ branchExists })
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

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'admin-pass' })
      .expect(200)
    adminToken = adminLogin.body.accessToken as string

    const customer = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        firstName: 'Juan',
        lastName: 'Perez',
        email: 'cliente-authz@test.com',
        phone: '11223344',
        password: 'password123',
      })
      .expect(201)
    tokens.customer = customer.body.accessToken as string
    customerId = (jwt.decode(tokens.customer) as jwt.JwtPayload).userId as string

    const staff = await request(app.getHttpServer())
      .post('/v1/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Branch',
        lastName: 'Admin',
        email: 'branch-authz@test.com',
        phone: '1',
        password: 'password123',
        branchId: 'branch-1',
      })
      .expect(201)
    editableTargetId = staff.body.id as string
    const branchLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'branch-authz@test.com', password: 'password123' })
      .expect(200)
    tokens.branch_admin = branchLogin.body.accessToken as string

    await request(app.getHttpServer())
      .post('/v1/users/riders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Raul',
        lastName: 'Rider',
        email: 'rider-authz@test.com',
        phone: '1',
        password: 'password123',
        vehicle: 'Moto',
      })
      .expect(201)
    const riderLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'rider-authz@test.com', password: 'password123' })
      .expect(200)
    tokens.rider = riderLogin.body.accessToken as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('PATCH /v1/me', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).patch('/v1/me').send(validProfile).expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'sin firstName', body: { lastName: 'Perez', phone: '999' } },
      { name: 'sin lastName', body: { firstName: 'Pedro', phone: '999' } },
      { name: 'sin phone', body: { firstName: 'Pedro', lastName: 'Perez' } },
      { name: 'vacío', body: {} },
    ])('rechaza un body parcial ($name) con 400', async ({ body }) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${tokens.customer}`)
        .send(body)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'firstName > 100', body: { ...validProfile, firstName: 'a'.repeat(101) } },
      { name: 'lastName > 100', body: { ...validProfile, lastName: 'a'.repeat(101) } },
      { name: 'phone > 50', body: { ...validProfile, phone: 'a'.repeat(51) } },
    ])('rechaza longitudes fuera de límite ($name) con 400', async ({ body }) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${tokens.customer}`)
        .send(body)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('permite a un rol no-customer actualizar su propio perfil (sin restricción de rol)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${tokens.rider}`)
        .send(validProfile)
        .expect(200)

      expect(res.body.firstName).toBe(validProfile.firstName)
    })
  })

  describe('GET /v1/me', () => {
    it('devuelve 404 USER_NOT_FOUND si el usuario del token ya no existe', async () => {
      const ghostId = new Types.ObjectId().toString()
      const ghostToken = jwt.sign(
        { sub: ghostId, userId: ghostId, roles: ['customer'], branchId: null },
        env.jwtSecret,
        { expiresIn: '15m' },
      )

      const res = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${ghostToken}`)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('PATCH /v1/users/:userId (autorización)', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${editableTargetId}`)
        .send({ firstName: 'X' })
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each(forbiddenRoles)('rechaza a %s con 403 (guard de roles)', async (role) => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${editableTargetId}`)
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({ firstName: 'X' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('PATCH /v1/users/:userId/active (autorización)', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${editableTargetId}/active`)
        .send({ active: false })
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each(forbiddenRoles)('rechaza a %s con 403 (guard de roles)', async (role) => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${editableTargetId}/active`)
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({ active: false })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('GET /v1/users/:userId (autorización interna)', () => {
    it('rechaza sin token y con x-internal-token incorrecto con 401', async () => {
      const withoutToken = await request(app.getHttpServer())
        .get(`/v1/users/${customerId}`)
        .expect(401)
      expect(withoutToken.body.code).toBe('UNAUTHENTICATED')

      const wrongInternal = await request(app.getHttpServer())
        .get(`/v1/users/${customerId}`)
        .set('X-Internal-Token', 'internal-token-invalido')
        .expect(401)
      expect(wrongInternal.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('POST /v1/auth/password-recovery', () => {
    it('responde 200 con { ok: true }', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/password-recovery')
        .send({ email: 'cliente-authz@test.com' })
        .expect(200)

      expect(res.body).toEqual({ ok: true })
    })
  })

  describe('POST /v1/auth/reset-password', () => {
    it('responde 200 con { ok: true }', async () => {
      await recoveryModel.create({
        userId: customerId,
        tokenHash: sha256('authorization-reset-token'),
        expiresAt: new Date(Date.now() + 60_000),
        used: false,
      })

      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'authorization-reset-token', newPassword: 'newpassword123' })
        .expect(200)

      expect(res.body).toEqual({ ok: true })
    })
  })

  describe('Address authorization (403 rol no-customer)', () => {
    const addressId = new Types.ObjectId().toString()

    it.each([
      { name: 'crear', method: 'post' as const, path: '/v1/addresses', body: validAddress },
      {
        name: 'obtener',
        method: 'get' as const,
        path: `/v1/addresses/${addressId}`,
        body: undefined,
      },
      {
        name: 'modificar',
        method: 'patch' as const,
        path: `/v1/addresses/${addressId}`,
        body: { label: 'X' },
      },
      {
        name: 'eliminar',
        method: 'delete' as const,
        path: `/v1/addresses/${addressId}`,
        body: undefined,
      },
    ])('rechaza a un rol no-customer al $name con 403', async ({ method, path, body }) => {
      const base = request(app.getHttpServer())
      const req = base[method](path).set('Authorization', `Bearer ${adminToken}`)
      const res = await (body ? req.send(body) : req).expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
