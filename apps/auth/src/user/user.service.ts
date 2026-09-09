import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import { ERROR_CODES, Role } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicUser, serializeUser } from './user.model'
import { UpdateUserData, UserListQuery, UserRepository } from './user.repository'

export type { PublicUser } from './user.model'

const BCRYPT_ROUNDS = 10

export interface CreateUserInput {
  email: string
  password: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  branchId?: string | null
  vehicle?: string | null
}

export interface UserListResponse {
  data: PublicUser[]
  meta: { total: number; limit: number; offset: number }
}

@Injectable()
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const existing = await this.repository.findByEmail(input.email)
    if (existing) {
      throw new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409)
    }

    const passwordHash = await hash(input.password, BCRYPT_ROUNDS)
    const { password: _password, ...data } = input
    const doc = await this.repository.create({ ...data, passwordHash })
    return serializeUser(doc)
  }

  async verifyCredentials(email: string, password: string): Promise<PublicUser> {
    const doc = await this.repository.findByEmailWithPassword(email)
    if (!doc) {
      throw new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401)
    }

    const matches = await compare(password, doc.passwordHash)
    if (!matches) {
      throw new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401)
    }

    if (!doc.active) {
      throw new DomainException(ERROR_CODES.userInactive, 'Usuario inactivo', 403)
    }

    return serializeUser(doc)
  }

  async findByEmail(email: string): Promise<PublicUser | null> {
    const doc = await this.repository.findByEmail(email)
    return doc ? serializeUser(doc) : null
  }

  async findById(id: string): Promise<PublicUser | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeUser(doc) : null
  }

  async list(query: UserListQuery): Promise<UserListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeUser),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async update(id: string, patch: UpdateUserData): Promise<PublicUser | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializeUser(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicUser | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeUser(doc) : null
  }

  async setPassword(id: string, password: string): Promise<void> {
    const passwordHash = await hash(password, BCRYPT_ROUNDS)
    await this.repository.updatePassword(id, passwordHash)
  }
}
