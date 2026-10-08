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
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { CommerceClient } from '../src/config/http/commerce.client'
import { SecurityModule } from '../src/config/security/security.module'
import { EMAIL_PROVIDER } from '../src/email/email.model'
import { UserModule } from '../src/user/user.module'

interface AddressRow {
  userId: string
  label: string
  text: string
  latitude: number
  longitude: number
  active: boolean
}

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

const validAddress = {
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  latitude: -34.6,
  longitude: -58.4,
}

describe('Addresses (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let addressModel: Model<AddressRow>
  let userModel: Model<UserRow>

  let customerToken = ''
  let otherToken = ''
  let adminToken = ''

  const register = (email: string) =>
    request(app.getHttpServer()).post('/v1/auth/register').send({
      firstName: 'Juan',
      lastName: 'Perez',
      email,
      phone: '11223344',
      password: 'password123',
    })

  const createAddress = async (
    token: string,
    overrides: Partial<typeof validAddress> = {},
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, ...overrides })
      .expect(201)
    return res.body.id as string
  }

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        UserModule,
        AuthModule,
        AddressModule,
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

    addressModel = app.get<Model<AddressRow>>(getModelToken('Address'))
    userModel = app.get<Model<UserRow>>(getModelToken('User'))

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

    const customer = await register('cliente@test.com').expect(201)
    customerToken = customer.body.accessToken as string

    const other = await register('otro@test.com').expect(201)
    otherToken = other.body.accessToken as string

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'admin-pass' })
      .expect(200)
    adminToken = login.body.accessToken as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('CRUD /v1/addresses', () => {
    it('crea una dirección propia (201) con los campos enviados', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validAddress)
        .expect(201)

      expect(res.body.id).toBeTruthy()
      expect(res.body.label).toBe('Casa')
      expect(res.body.text).toBe(validAddress.text)
      expect(res.body.latitude).toBe(-34.6)
      expect(res.body.active).toBe(true)
    })

    it('lista solo las direcciones propias', async () => {
      await addressModel.deleteMany({})
      const mine = await createAddress(customerToken)
      await createAddress(otherToken, { label: 'Otro' })

      const res = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].id).toBe(mine)
    })

    it('obtiene una dirección propia por id (200)', async () => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .get(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(res.body.id).toBe(id)
    })

    it('devuelve 404 para una dirección inexistente con id válido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/addresses/${new Types.ObjectId().toString()}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404)

      expect(res.body.code).toBe('ADDRESS_NOT_FOUND')
    })

    it('devuelve 404/aislamiento al acceder a la dirección de otro usuario', async () => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .get(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)

      expect(res.body.code).toBe('ADDRESS_NOT_FOUND')
    })

    it('devuelve 404/aislamiento al modificar la dirección de otro usuario', async () => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .patch(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ label: 'Hack' })
        .expect(404)

      expect(res.body.code).toBe('ADDRESS_NOT_FOUND')
    })

    it('devuelve 404/aislamiento al eliminar la dirección de otro usuario', async () => {
      const id = await createAddress(customerToken)

      await request(app.getHttpServer())
        .delete(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)

      const stillOwned = await addressModel.findById(id)
      expect(stillOwned?.active).toBe(true)
    })

    it('modifica los campos de una dirección propia', async () => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .patch(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Trabajo', text: 'Oficina 1', latitude: -34.5 })
        .expect(200)

      expect(res.body.label).toBe('Trabajo')
      expect(res.body.text).toBe('Oficina 1')
    })

    it('elimina (soft-delete) y el documento persiste con active:false', async () => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .delete(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      expect(res.body).toEqual({ ok: true })

      const list = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
      expect(list.body.data.find((a: AddressRow & { id: string }) => a.id === id)).toBeUndefined()

      const doc = await addressModel.findById(id)
      expect(doc).not.toBeNull()
      expect(doc?.active).toBe(false)
    })

    it('devuelve 404 en el segundo DELETE de la misma dirección', async () => {
      const id = await createAddress(customerToken)

      await request(app.getHttpServer())
        .delete(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)

      const res = await request(app.getHttpServer())
        .delete(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404)

      expect(res.body.code).toBe('ADDRESS_NOT_FOUND')
    })
  })

  describe('autorización (401/403)', () => {
    it.each([
      { name: 'listar', method: 'get' as const, path: '/v1/addresses', withId: false },
      { name: 'crear', method: 'post' as const, path: '/v1/addresses', withId: false },
      {
        name: 'obtener',
        method: 'get' as const,
        path: '/v1/addresses/:id',
        withId: true,
      },
      {
        name: 'modificar',
        method: 'patch' as const,
        path: '/v1/addresses/:id',
        withId: true,
      },
      {
        name: 'eliminar',
        method: 'delete' as const,
        path: '/v1/addresses/:id',
        withId: true,
      },
    ])('responde 401 sin token al $name', async ({ method, path, withId }) => {
      const target = withId ? path.replace(':id', new Types.ObjectId().toString()) : path
      const res = await request(app.getHttpServer())[method](target).expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('responde 403 a un rol distinto de customer', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('validaciones (400)', () => {
    it.each([
      { name: 'label vacío', patch: { label: '' } },
      { name: 'text vacío', patch: { text: '' } },
      { name: 'label demasiado largo', patch: { label: 'a'.repeat(101) } },
      { name: 'text demasiado largo', patch: { text: 'a'.repeat(301) } },
      { name: 'latitude fuera de rango', patch: { latitude: 91 } },
      { name: 'longitude fuera de rango', patch: { longitude: 181 } },
    ])('rechaza al crear con $name', async ({ patch }) => {
      const res = await request(app.getHttpServer())
        .post('/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ ...validAddress, ...patch })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'label demasiado largo', patch: { label: 'a'.repeat(101) } },
      { name: 'text demasiado largo', patch: { text: 'a'.repeat(301) } },
      { name: 'latitude fuera de rango', patch: { latitude: -91 } },
      { name: 'longitude fuera de rango', patch: { longitude: -181 } },
    ])('rechaza al modificar con $name', async ({ patch }) => {
      const id = await createAddress(customerToken)

      const res = await request(app.getHttpServer())
        .patch(`/v1/addresses/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(patch)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('responde 404 (ADDRESS_NOT_FOUND) con un id de formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/addresses/not-a-valid-object-id')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404)

      expect(res.body.code).toBe('ADDRESS_NOT_FOUND')
    })
  })

  describe('userId no-ObjectId en el JWT (defensa CastError)', () => {
    const malformedUserId = 'not-a-valid-object-id'
    const malformedToken = jwt.sign(
      { sub: malformedUserId, userId: malformedUserId, roles: ['customer'], branchId: null },
      env.jwtSecret,
      { expiresIn: '15m' },
    )

    it('GET /v1/addresses devuelve lista vacía (200) en vez de 500', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/addresses')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(200)

      expect(res.body.data).toEqual([])
    })

    it('POST /v1/addresses responde 404 USER_NOT_FOUND sin persistir', async () => {
      const before = await addressModel.countDocuments({ userId: malformedUserId })

      const res = await request(app.getHttpServer())
        .post('/v1/addresses')
        .set('Authorization', `Bearer ${malformedToken}`)
        .send(validAddress)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
      const after = await addressModel.countDocuments({ userId: malformedUserId })
      expect(after).toBe(before)
    })
  })
})
