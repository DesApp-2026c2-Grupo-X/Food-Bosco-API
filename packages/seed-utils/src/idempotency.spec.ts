import { insertIfAbsent, isDuplicateKeyError, SeedReporter, upsertOne } from './idempotency'
import type { UpsertableModel } from './idempotency'

describe('upsertOne', () => {
  it('hace findOneAndUpdate con upsert y $set por la clave natural', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: '1', name: 'Centro' })
    const model: UpsertableModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
    }

    const result = await upsertOne(model, { name: 'Centro' }, { active: true })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { name: 'Centro' },
      { $set: { active: true } },
      { new: true, upsert: true },
    )
    expect(result).toEqual({ _id: '1', name: 'Centro' })
  })

  it('devuelve null cuando no hay documento (upsert sin match)', async () => {
    const model: UpsertableModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }

    await expect(upsertOne(model, { name: 'X' }, {})).resolves.toBeNull()
  })
})

describe('insertIfAbsent', () => {
  it('usa $setOnInsert con upsert por la clave natural', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: '1', name: 'Centro' })
    const model: UpsertableModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
    }

    const result = await insertIfAbsent(model, { name: 'Centro' }, { active: true })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { name: 'Centro' },
      { $setOnInsert: { active: true } },
      { new: true, upsert: true },
    )
    expect(result).toEqual({ _id: '1', name: 'Centro' })
  })
})

describe('isDuplicateKeyError', () => {
  it.each([
    { name: 'otro código', error: { code: 500 }, expected: false },
    { name: 'sin campo code', error: { message: 'boom' }, expected: false },
    { name: 'null', error: null, expected: false },
    { name: 'string', error: 'error', expected: false },
    { name: 'undefined', error: undefined, expected: false },
  ])('$name → $expected', ({ error, expected }) => {
    expect(isDuplicateKeyError(error)).toBe(expected)
  })
})

describe('SeedReporter', () => {
  it('acumula creados y omitidos y expone un resumen', () => {
    const reporter = new SeedReporter()

    reporter.recordCreated()
    reporter.recordCreated()
    reporter.recordSkipped()

    expect(reporter.created).toBe(2)
    expect(reporter.skipped).toBe(1)
    expect(reporter.summary()).toEqual({ created: 2, skipped: 1 })
  })

  it('parte de cero', () => {
    const reporter = new SeedReporter()

    expect(reporter.summary()).toEqual({ created: 0, skipped: 0 })
  })
})
