import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { hash } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createHash } from 'node:crypto'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AddressModule } from '../src/address/address.module'
import { AuthModule } from '../src/auth/auth.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
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

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

describe('Auth Service (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<UserRow>
  let recoveryModel: Model<RecoveryRow>

  let customerToken = ''
  let customerId = ''
  let adminToken = ''

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        firstName: 'Juan',
        lastName: 'Perez',
        email,
        phone: '11223344',
        password: 'password123',
      })

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()

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
    }).compile()

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

    const regRes = await register('cliente@test.com').expect(201)
    customerToken = regRes.body.accessToken as string
    customerId = (jwt.decode(customerToken) as jwt.JwtPayload).userId as string

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'admin-pass' })
      .expect(200)
    adminToken = loginRes.body.accessToken as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('registro (RQ-AUTH-01/02/03)', () => {
    it('registra un cliente y devuelve access + refresh token', async () => {
      const res = await register('nuevo@test.com').expect(201)

      expect(res.body.accessToken).toBeTruthy()
      expect(res.body.refreshToken).toBeTruthy()

      const payload = jwt.decode(res.body.accessToken as string) as jwt.JwtPayload
      expect(payload.roles).toEqual(['customer'])
      expect(payload.userId).toBeTruthy()
    })

    it('rechaza un correo duplicado con 409 EMAIL_TAKEN', async () => {
      const res = await register('cliente@test.com').expect(409)

      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('rechaza datos inválidos con 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'no-valido' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('login (RQ-AUTH-04/06)', () => {
    it('loguea con credenciales válidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'cliente@test.com', password: 'password123' })
        .expect(200)

      expect(res.body.accessToken).toBeTruthy()
      expect(res.body.refreshToken).toBeTruthy()
    })

    it.each([
      { name: 'contraseña incorrecta', email: 'cliente@test.com', password: 'mala-clave' },
      { name: 'correo inexistente', email: 'no-existe@test.com', password: 'password123' },
    ])('rechaza con error genérico: $name', async ({ email, password }) => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(401)

      expect(res.body.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('me (RQ-AUTH-11/18)', () => {
    it('devuelve el perfil autenticado sin exponer el hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(res.body.id).toBe(customerId)
      expect(res.body.role).toBe('customer')
      expect(res.body.passwordHash).toBeUndefined()
    })

    it('permite modificar el propio perfil', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ firstName: 'Pedro', lastName: 'Gomez', phone: '999' })
        .expect(200)

      expect(res.body.firstName).toBe('Pedro')
    })

    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/me').expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('refresh y logout (RQ-AUTH-07/08)', () => {
    it('refresca el access token y rota el refresh', async () => {
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'cliente@test.com', password: 'password123' })
        .expect(200)

      const refresh = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200)

      expect(refresh.body.accessToken).toBeTruthy()
      expect(refresh.body.refreshToken).toBeTruthy()
      expect(refresh.body.refreshToken).not.toBe(login.body.refreshToken)

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401)
    })

    it('rechaza un refresh token inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'token-invalido' })
        .expect(401)

      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
    })

    it('cierra sesión y revoca los refresh tokens', async () => {
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'cliente@test.com', password: 'password123' })
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401)
    })
  })

  describe('recuperación de contraseña (RQ-AUTH-09/10)', () => {
    it('responde neutral tanto si el correo existe como si no', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/password-recovery')
        .send({ email: 'cliente@test.com' })
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/auth/password-recovery')
        .send({ email: 'no-existe@test.com' })
        .expect(200)
    })

    it('restablece la contraseña con un token válido', async () => {
      await recoveryModel.create({
        userId: customerId,
        tokenHash: sha256('reset-token-123'),
        expiresAt: new Date(Date.now() + 60_000),
        used: false,
      })

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'reset-token-123', newPassword: 'nueva-clave-123' })
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'cliente@test.com', password: 'nueva-clave-123' })
        .expect(200)
    })

    it('rechaza un token inválido o ya usado', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token: 'reset-token-123', newPassword: 'otra-clave-123' })
        .expect(400)

      expect(res.body.code).toBe('INVALID_OR_EXPIRED_TOKEN')
    })
  })

  describe('direcciones (RQ-AUTH-19/20/21/22)', () => {
    let addressId = ''

    it('crea una dirección propia', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Casa',
          text: 'Av. Siempre Viva 123',
          city: 'CABA',
          latitude: -34.6,
          longitude: -58.4,
        })
        .expect(201)

      addressId = res.body.id as string
      expect(res.body.label).toBe('Casa')
    })

    it('lista solo las direcciones propias', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].id).toBe(addressId)
    })

    it('modifica y elimina (desactiva) una dirección propia', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/addresses/${addressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Trabajo' })
        .expect(200)

      await request(app.getHttpServer())
        .delete(`/v1/addresses/${addressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      const list = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(list.body.data).toHaveLength(0)
    })
  })

  describe('administración de usuarios (RQ-AUTH-12..17)', () => {
    it('crea un colaborador de sucursal (branch_admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'S',
          lastName: 'S',
          email: 'staff@test.com',
          phone: '1',
          password: 'password123',
          branchId: 'branch-1',
        })
        .expect(201)

      expect(res.body.role).toBe('branch_admin')
      expect(res.body.branchId).toBe('branch-1')
    })

    it('crea otro super_admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/users/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'A',
          lastName: 'A',
          email: 'admin2@test.com',
          phone: '1',
          password: 'password123',
        })
        .expect(201)

      expect(res.body.role).toBe('super_admin')
    })

    it('crea un repartidor', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/users/riders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'R',
          lastName: 'R',
          email: 'rider@test.com',
          phone: '1',
          password: 'password123',
          vehicle: 'Moto',
        })
        .expect(201)

      expect(res.body.role).toBe('rider')
      expect(res.body.vehicle).toBe('Moto')
    })

    it('lista usuarios con filtros y paginación', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users?role=rider&limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].email).toBe('rider@test.com')
      expect(res.body.meta.total).toBe(1)
    })

    it('activa/desactiva un usuario sin borrado físico', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/users?search=staff@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const staffId = list.body.data[0].id as string

      await request(app.getHttpServer())
        .patch(`/v1/users/${staffId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200)

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(403)
    })

    it('rechaza a un cliente listar usuarios con 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('permite el acceso interno con X-Internal-Token (RQ-AUTH-17)', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/${customerId}`)
        .set('X-Internal-Token', env.internalApiToken)
        .expect(200)
    })
  })

  describe('auto-registro de repartidor (register-rider)', () => {
    it('registra un rider con vehicle', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register-rider')
        .send({
          firstName: 'R',
          lastName: 'R',
          email: 'rider-self@test.com',
          phone: '1',
          password: 'password123',
          vehicle: 'Bici',
        })
        .expect(201)

      const payload = jwt.decode(res.body.accessToken as string) as jwt.JwtPayload
      expect(payload.roles).toEqual(['rider'])

      const me = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200)
      expect(me.body.vehicle).toBe('Bici')
    })
  })
})
