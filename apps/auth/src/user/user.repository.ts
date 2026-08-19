import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Role } from '../config/constants'
import { User, UserDocument } from './user.model'

export interface CreateUserData {
  email: string
  passwordHash: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  branchId?: string | null
  vehicle?: string | null
}

export interface UpdateUserData {
  firstName?: string
  lastName?: string
  phone?: string
  branchId?: string | null
}

export interface UserListQuery {
  role?: Role
  active?: boolean
  search?: string
  limit: number
  offset: number
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email }).exec()
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email }).select('+passwordHash').exec()
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).exec()
  }

  findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).select('+passwordHash').exec()
  }

  create(data: CreateUserData): Promise<UserDocument> {
    return this.model.create({ ...data, active: true })
  }

  async list(query: UserListQuery): Promise<{ data: UserDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}

    if (query.role) filter.role = query.role
    if (query.active !== undefined) filter.active = query.active
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i')
      filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }]
    }

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdateUserData): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { passwordHash } }).exec()
  }
}
