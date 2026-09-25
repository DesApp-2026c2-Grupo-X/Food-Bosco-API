import { Injectable } from '@nestjs/common'
import { PublicShift, serializeShift } from './shift.model'
import { CreateShiftData, ShiftRepository } from './shift.repository'

@Injectable()
export class ShiftService {
  constructor(private readonly repository: ShiftRepository) {}

  async list(): Promise<PublicShift[]> {
    const docs = await this.repository.findAll()
    return docs.map(serializeShift)
  }

  async listActive(): Promise<PublicShift[]> {
    const docs = await this.repository.findActive()
    return docs.map(serializeShift)
  }

  async findById(id: string): Promise<PublicShift | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeShift(doc) : null
  }

  async findByName(name: string): Promise<PublicShift | null> {
    const doc = await this.repository.findByName(name)
    return doc ? serializeShift(doc) : null
  }

  async create(data: CreateShiftData): Promise<PublicShift> {
    const doc = await this.repository.create(data)
    return serializeShift(doc)
  }

  async upsertByName(name: string, data: CreateShiftData): Promise<PublicShift | null> {
    const doc = await this.repository.upsertByName(name, data)
    return doc ? serializeShift(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicShift | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeShift(doc) : null
  }
}
