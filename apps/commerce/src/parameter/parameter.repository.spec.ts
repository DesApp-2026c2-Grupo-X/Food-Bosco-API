import type { Model } from 'mongoose'
import type { ParameterDocument } from './parameter.model'
import { ParameterRepository } from './parameter.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const parameterDoc = (key: string, value: number, unit = 'km'): ParameterDocument =>
  ({ key, value, unit }) as unknown as ParameterDocument

const makeRepository = () => {
  const model = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }
  return {
    repository: new ParameterRepository(model as unknown as Model<ParameterDocument>),
    model,
  }
}

describe('ParameterRepository.update (NEW-08)', () => {
  it('actualiza solo la clave indicada sin upsert y devuelve el documento nuevo', async () => {
    const { repository, model } = makeRepository()
    const doc = parameterDoc('AVG_SPEED_KMH', 30, 'km/h')
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.update('AVG_SPEED_KMH', 30)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'AVG_SPEED_KMH' },
      { $set: { value: 30 } },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si la clave no existe (no crea un documento sin unit)', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.update('CLAVE_INEXISTENTE', 5)).resolves.toBeNull()
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'CLAVE_INEXISTENTE' },
      { $set: { value: 5 } },
      { new: true },
    )
  })
})

describe('ParameterRepository.upsertByKey (mantiene el alta)', () => {
  it('usa $setOnInsert con upsert para crear la clave si no existe', async () => {
    const { repository, model } = makeRepository()
    const data = { key: 'BASE_PREP_MIN', value: 15, unit: 'min' }
    const doc = parameterDoc(data.key, data.value, data.unit)
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.upsertByKey(data)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'BASE_PREP_MIN' },
      { $setOnInsert: data },
      { new: true, upsert: true },
    )
    expect(result).toBe(doc)
  })
})
