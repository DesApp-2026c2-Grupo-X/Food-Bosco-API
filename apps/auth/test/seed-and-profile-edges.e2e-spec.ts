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
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { CommerceClient } from '../src/config/http/commerce.client'
import { SecurityModule } from '../src/config/security/security.module'
import { SeedModule } from '../src/seed/seed.module'
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

const ghostProfile = { firstName: 'Pedro', lastName: 'Gomez', phone: '999' }

describe('Seed & profile edges (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<UserRow>

  const branchExists = jest.fn().mockResolvedValue(true)
  let editableTargetId = ''

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), SecurityModule, UserModule, SeedModule],
    })
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

    const target = await userModel.create({
      email: 'target-edge@test.com',
      passwordHash: await hash('password123', 10),
      role: 'branch_admin',
      firstName: 'Target',
      lastName: 'Edge',
      phone: '111',
      active: true,
      branchId: 'branch-1',
      vehicle: null,
    })
    editableTargetId = target._id.toString()
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('PATCH /v1/me (token de un userId inexistente)', () => {
    it('rechaza con 404 USER_NOT_FOUND, igual que GET /v1/me', async () => {
      const ghostId = new Types.ObjectId().toString()
      const ghostToken = jwt.sign(
        { sub: ghostId, userId: ghostId, roles: ['customer'], branchId: null },
        env.jwtSecret,
        { expiresIn: '15m' },
      )

      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${ghostToken}`)
        .send(ghostProfile)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })

    it('rechaza con 404 USER_NOT_FOUND un userId no-ObjectId (defensa CastError)', async () => {
      const malformedUserId = 'not-a-valid-object-id'
      const malformedToken = jwt.sign(
        { sub: malformedUserId, userId: malformedUserId, roles: ['customer'], branchId: null },
        env.jwtSecret,
        { expiresIn: '15m' },
      )

      const res = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${malformedToken}`)
        .send(ghostProfile)
        .expect(404)

      expect(res.body.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('PATCH /v1/users/:userId (acceso super_admin, sin vía interna según contrato)', () => {
    // El contrato (§6.2) define PATCH /v1/users/{userId} como `super_admin` únicamente;
    // sólo GET /v1/users/{userId} admite "super_admin / interno". Esta ruta no declara
    // @Internal(), así que x-internal-token no la habilita: cae al flujo JWT y responde 401.
    it('con x-internal-token válido no habilita la vía interna y responde 401', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${editableTargetId}`)
        .set('x-internal-token', env.internalApiToken)
        .send({ firstName: 'Interno' })
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('POST /v1/seed (branchId no-string)', () => {
    // El contrato define branchId como string. Se declara como union
    // (string | number | boolean) para evitar la coerción implícita del ValidationPipe
    // global; así @IsString rechaza cualquier valor no-string con 400 VALIDATION_ERROR.
    it.each([
      { name: 'number 123', branchId: 123 },
      { name: 'boolean true', branchId: true },
      { name: 'array', branchId: ['branch-1'] },
    ])('rechaza branchId $name con 400 VALIDATION_ERROR', async ({ branchId }) => {
      await userModel.deleteMany({})

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({ branchId })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
      expect(await userModel.countDocuments({ role: 'branch_admin' })).toBe(0)
    })
  })
})
