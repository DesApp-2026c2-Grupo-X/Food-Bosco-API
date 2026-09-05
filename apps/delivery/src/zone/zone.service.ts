import { Injectable } from '@nestjs/common'
import { PublicZone, serializeZone } from './zone.model'
import { CreateZoneData, ZoneRepository } from './zone.repository'

@Injectable()
export class ZoneService {
  constructor(private readonly repository: ZoneRepository) {}

  async list(): Promise<PublicZone[]> {
    const docs = await this.repository.findAll()
    return docs.map(serializeZone)
  }

  async listActive(): Promise<PublicZone[]> {
    const docs = await this.repository.findActive()
    return docs.map(serializeZone)
  }

  async findById(id: string): Promise<PublicZone | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeZone(doc) : null
  }

  async findByName(name: string): Promise<PublicZone | null> {
    const doc = await this.repository.findByName(name)
    return doc ? serializeZone(doc) : null
  }

  async create(data: CreateZoneData): Promise<PublicZone> {
    const doc = await this.repository.create(data)
    return serializeZone(doc)
  }

  async upsertByName(name: string, data: CreateZoneData): Promise<PublicZone | null> {
    const doc = await this.repository.upsertByName(name, data)
    return doc ? serializeZone(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicZone | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeZone(doc) : null
  }
}
