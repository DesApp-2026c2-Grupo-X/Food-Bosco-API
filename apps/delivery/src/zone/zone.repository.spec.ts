import type { Model } from 'mongoose'
import type { ZoneDocument } from './zone.model'
import { ZoneRepository } from './zone.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const model = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  const repository = new ZoneRepository(model as unknown as Model<ZoneDocument>)
  return { repository, model }
}

describe('ZoneRepository.findById (INT-02)', () => {
  const validId = '64b000000000000000000001'

  it('busca por _id y devuelve el documento', async () => {
    const { repository, model } = makeRepository()
    const doc = { name: 'Centro' }
    model.findById.mockReturnValue(execQuery(doc))

    await expect(repository.findById(validId)).resolves.toBe(doc)
    expect(model.findById).toHaveBeenCalledWith(validId)
  })

  it('devuelve null si la zona no existe', async () => {
    const { repository, model } = makeRepository()
    model.findById.mockReturnValue(execQuery(null))

    await expect(repository.findById(validId)).resolves.toBeNull()
  })

  it.each(['abc', '', '123', 'no-es-un-object-id'])(
    'devuelve null con id inválido (%s) sin consultar el modelo',
    async (id) => {
      const { repository, model } = makeRepository()

      await expect(repository.findById(id)).resolves.toBeNull()
      expect(model.findById).not.toHaveBeenCalled()
    },
  )
})

describe('ZoneRepository.setActive (INT-02)', () => {
  const validId = '64b000000000000000000002'

  it('actualiza active y devuelve el documento', async () => {
    const { repository, model } = makeRepository()
    const doc = { name: 'Centro', active: false }
    model.findByIdAndUpdate.mockReturnValue(execQuery(doc))

    await expect(repository.setActive(validId, false)).resolves.toBe(doc)
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      validId,
      { $set: { active: false } },
      { new: true },
    )
  })

  it.each(['abc', '123'])(
    'devuelve null con id inválido (%s) sin consultar el modelo',
    async (id) => {
      const { repository, model } = makeRepository()

      await expect(repository.setActive(id, false)).resolves.toBeNull()
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled()
    },
  )
})
