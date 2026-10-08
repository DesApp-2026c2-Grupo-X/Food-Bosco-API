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
import { AuthModule } from '../src/auth/auth.module'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { CommerceClient } from '../src/config/http/commerce.client'
import { SecurityModule } from '../src/config/security/security.module'
import { EMAIL_PROVIDER } from '../src/email/email.model'
import { UserModule } from '../src/user/user.module'
import { User } from '../src/user/user.model'

const staffBody = {
  firstName: 'Sofia',
  lastName: 'Sosa',
  phone: '11223344',
  password: 'password123',
  branchId: 'branch-1',
}

const adminBody = {
  firstName: 'Ana',
  lastName: 'Admin',
  phone: '11223344',
  password: 'password123',
}

const riderBody = {
  firstName: 'Raul',
  lastName: 'Rider',
  phone: '11223344',
  password: 'password123',
  vehicle: 'Moto',
}

let coercionSeq = 0
const coercionEmail = (): string => `coercion-${++coercionSeq}@test.com`

describe('Users admin (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<User>

  let adminToken = ''
  let customerToken = ''
  let adminId = ''

  const register = (email: string) =>
    request(app.getHttpServer()).post('/v1/auth/register').send({
      firstName: 'Juan',
      lastName: 'Perez',
      email,
      phone: '11223344',
      password: 'password123',
    })

  const createUser = (path: 'staff' | 'admins' | 'riders', body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/v1/users/${path}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), SecurityModule, UserModule, AuthModule],
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

    userModel = app.get<Model<User>>(getModelToken('User'))

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

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'admin-pass' })
      .expect(200)
    adminToken = login.body.accessToken as string
    adminId = (jwt.decode(adminToken) as jwt.JwtPayload).userId as string

    const customer = await register('cliente@test.com').expect(201)
    customerToken = customer.body.accessToken as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/users', () => {
    it('usa los defaults de paginación (limit 20 / offset 0)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.meta.limit).toBe(20)
      expect(res.body.meta.offset).toBe(0)
    })

    it('filtra por rol', async () => {
      await createUser('riders', { ...riderBody, email: 'filter-rider@test.com' }).expect(201)

      const res = await request(app.getHttpServer())
        .get('/v1/users?role=rider')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data.every((u: { role: string }) => u.role === 'rider')).toBe(true)
    })

    it('filtra por active=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users?active=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data.every((u: { active: boolean }) => u.active === true)).toBe(true)
    })

    it('filtra por active=false (sólo inactivos)', async () => {
      await register('inactive-list@test.com').expect(201)
      await userModel.updateOne({ email: 'inactive-list@test.com' }, { $set: { active: false } })

      const res = await request(app.getHttpServer())
        .get('/v1/users?active=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data.every((u: { active: boolean }) => u.active === false)).toBe(true)
      expect(
        res.body.data.some((u: { email: string }) => u.email === 'inactive-list@test.com'),
      ).toBe(true)
    })

    it('busca por texto (email/nombre)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users?search=filter-rider')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].email).toBe('filter-rider@test.com')
    })

    it('respeta la paginación explícita', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta.limit).toBe(1)
      expect(res.body.meta.offset).toBe(0)
    })

    it.each(['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'role=invalid'])(
      'rechaza paginación/filtro inválido (%s) con 400',
      async (query) => {
        const res = await request(app.getHttpServer())
          .get(`/v1/users?${query}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400)

        expect(res.body.code).toBe('VALIDATION_ERROR')
      },
    )

    it('rechaza sin token (401) y a un cliente (403)', async () => {
      await request(app.getHttpServer()).get('/v1/users').expect(401)

      const forbidden = await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403)
      expect(forbidden.body.code).toBe('FORBIDDEN')
    })
  })

  describe('GET /v1/users/:userId', () => {
    it('devuelve el usuario vía Bearer super_admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.id).toBe(adminId)
    })

    it('devuelve 404 si el usuario no existe', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${new Types.ObjectId().toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })

    it('rechaza sin token (401) y a un cliente (403)', async () => {
      await request(app.getHttpServer()).get(`/v1/users/${adminId}`).expect(401)

      await request(app.getHttpServer())
        .get(`/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403)
    })

    it('responde 404 (USER_NOT_FOUND) con un id de formato inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users/not-a-valid-object-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('POST /v1/users/staff', () => {
    it('crea un branch_admin con el branchId indicado', async () => {
      const res = await createUser('staff', { ...staffBody, email: 'staff@test.com' }).expect(201)

      expect(res.body.role).toBe('branch_admin')
      expect(res.body.branchId).toBe('branch-1')
    })

    it('rechaza sin token (401) y a un cliente (403)', async () => {
      await request(app.getHttpServer()).post('/v1/users/staff').send(staffBody).expect(401)

      await request(app.getHttpServer())
        .post('/v1/users/staff')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(staffBody)
        .expect(403)
    })

    it('rechaza email duplicado con 409', async () => {
      const res = await createUser('staff', { ...staffBody, email: 'staff@test.com' }).expect(409)
      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('rechaza payload inválido con 400', async () => {
      const res = await createUser('staff', {
        firstName: staffBody.firstName,
        lastName: staffBody.lastName,
        phone: staffBody.phone,
        password: staffBody.password,
        email: 'no-branch@test.com',
      }).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('fuerza el rol branch_admin ignorando un rol enviado', async () => {
      const res = await createUser('staff', {
        ...staffBody,
        email: 'forced-staff@test.com',
        role: 'super_admin',
      }).expect(201)

      expect(res.body.role).toBe('branch_admin')
    })
  })

  describe('POST /v1/users/admins', () => {
    it('crea un super_admin', async () => {
      const res = await createUser('admins', { ...adminBody, email: 'admin2@test.com' }).expect(201)
      expect(res.body.role).toBe('super_admin')
    })

    it('rechaza sin token (401) y a un cliente (403)', async () => {
      await request(app.getHttpServer()).post('/v1/users/admins').send(adminBody).expect(401)

      await request(app.getHttpServer())
        .post('/v1/users/admins')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(adminBody)
        .expect(403)
    })

    it('rechaza email duplicado con 409', async () => {
      const res = await createUser('admins', { ...adminBody, email: 'admin2@test.com' }).expect(409)
      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('rechaza payload inválido con 400', async () => {
      const res = await createUser('admins', { ...adminBody, email: 'bad-email' }).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('fuerza el rol super_admin ignorando un rol enviado', async () => {
      const res = await createUser('admins', {
        ...adminBody,
        email: 'forced-admin@test.com',
        role: 'customer',
      }).expect(201)

      expect(res.body.role).toBe('super_admin')
    })
  })

  describe('POST /v1/users/riders', () => {
    it('crea un rider con su vehículo', async () => {
      const res = await createUser('riders', { ...riderBody, email: 'rider2@test.com' }).expect(201)
      expect(res.body.role).toBe('rider')
      expect(res.body.vehicle).toBe('Moto')
    })

    it('rechaza sin token (401) y a un cliente (403)', async () => {
      await request(app.getHttpServer()).post('/v1/users/riders').send(riderBody).expect(401)

      await request(app.getHttpServer())
        .post('/v1/users/riders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(riderBody)
        .expect(403)
    })

    it('rechaza email duplicado con 409', async () => {
      const res = await createUser('riders', { ...riderBody, email: 'rider2@test.com' }).expect(409)
      expect(res.body.code).toBe('EMAIL_TAKEN')
    })

    it('rechaza payload inválido con 400', async () => {
      const res = await createUser('riders', {
        ...riderBody,
        email: 'no-vehicle@test.com',
        vehicle: undefined,
      }).expect(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('fuerza el rol rider ignorando un rol enviado', async () => {
      const res = await createUser('riders', {
        ...riderBody,
        email: 'forced-rider@test.com',
        role: 'super_admin',
      }).expect(201)

      expect(res.body.role).toBe('rider')
    })
  })

  describe('PATCH /v1/users/:userId', () => {
    it('actualiza campos editables', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/users?search=staff@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const targetId = list.body.data[0].id as string

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Renombrada', lastName: 'Nueva', phone: '999' })
        .expect(200)

      expect(res.body.firstName).toBe('Renombrada')
      expect(res.body.lastName).toBe('Nueva')
      expect(res.body.phone).toBe('999')
    })

    it('devuelve 404 si el usuario no existe', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${new Types.ObjectId().toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'X' })
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })

    it('rechaza campos fuera de límite con 400', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/users?search=staff@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const targetId = list.body.data[0].id as string

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'a'.repeat(101) })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rechaza editar un super_admin con 403 (requireEditable)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Hack' })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('PATCH /v1/users/:userId/active', () => {
    it('desactiva (login 403) y reactiva (login 200)', async () => {
      await createUser('staff', { ...staffBody, email: 'toggle@test.com' }).expect(201)

      const list = await request(app.getHttpServer())
        .get('/v1/users?search=toggle@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const targetId = list.body.data[0].id as string

      const deactivated = await request(app.getHttpServer())
        .patch(`/v1/users/${targetId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200)
      expect(deactivated.body.active).toBe(false)

      const blocked = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'toggle@test.com', password: 'password123' })
        .expect(403)
      expect(blocked.body.code).toBe('USER_INACTIVE')

      const reactivated = await request(app.getHttpServer())
        .patch(`/v1/users/${targetId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true })
        .expect(200)
      expect(reactivated.body.active).toBe(true)

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'toggle@test.com', password: 'password123' })
        .expect(200)
    })

    it('rechaza desactivar un super_admin con 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${adminId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('devuelve 404 si el usuario no existe', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${new Types.ObjectId().toString()}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })

    it('rechaza un body sin active con 400', async () => {
      const list = await request(app.getHttpServer())
        .get('/v1/users?search=toggle@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      const targetId = list.body.data[0].id as string

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${targetId}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: "active 'false' string", body: { active: 'false' } },
      { name: "active 'true' string", body: { active: 'true' } },
      { name: 'active numérico (123)', body: { active: 123 } },
      { name: 'active numérico (1)', body: { active: 1 } },
      { name: 'active numérico (0)', body: { active: 0 } },
      { name: "active string no booleano ('yes')", body: { active: 'yes' } },
    ])('rechaza coerción booleana inválida ($name) con 400 (INT-03)', async ({ body }) => {
      const created = await createUser('staff', {
        ...staffBody,
        email: coercionEmail(),
      }).expect(201)

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${created.body.id as string}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'active true booleano', body: { active: true }, expected: true },
      { name: 'active false booleano', body: { active: false }, expected: false },
    ])('acepta active booleano ($name) (INT-03)', async ({ body, expected }) => {
      const created = await createUser('staff', {
        ...staffBody,
        email: coercionEmail(),
      }).expect(201)

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${created.body.id as string}/active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(200)

      expect(res.body.active).toBe(expected)
    })
  })
})
