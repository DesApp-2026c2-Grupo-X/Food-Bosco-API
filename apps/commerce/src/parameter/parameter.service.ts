import { Injectable } from '@nestjs/common'
import { PARAMETER_KEYS } from '../config/constants'
import { env } from '../config/env'
import { PublicParameter, serializeParameter } from './parameter.model'
import { CreateParameterData, ParameterRepository } from './parameter.repository'

const PARAMETER_DEFAULTS: Record<string, number> = {
  [PARAMETER_KEYS.maxDistanceKm]: env.seed.maxDistanceKm,
  [PARAMETER_KEYS.basePrepMin]: env.seed.basePrepMin,
  [PARAMETER_KEYS.avgSpeedKmh]: env.seed.avgSpeedKmh,
}

@Injectable()
export class ParameterService {
  constructor(private readonly repository: ParameterRepository) {}

  async list(): Promise<PublicParameter[]> {
    const docs = await this.repository.findAll()
    return docs.map(serializeParameter)
  }

  async findByKey(key: string): Promise<PublicParameter | null> {
    const doc = await this.repository.findByKey(key)
    return doc ? serializeParameter(doc) : null
  }

  async getValue(key: string): Promise<number> {
    const doc = await this.repository.findByKey(key)
    return doc ? doc.value : (PARAMETER_DEFAULTS[key] ?? 0)
  }

  async create(data: CreateParameterData): Promise<PublicParameter> {
    const doc = await this.repository.create(data)
    return serializeParameter(doc)
  }

  async update(key: string, value: number): Promise<PublicParameter> {
    const doc = await this.repository.update(key, value)
    return doc ? serializeParameter(doc) : { key, value, unit: '' }
  }
}
