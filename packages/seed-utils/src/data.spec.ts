import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSeedData, mergeDeep } from './data'

describe('mergeDeep', () => {
  it('fusiona en profundidad objetos anidados', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } }
    const override = { b: 2, nested: { y: 3 } }

    expect(mergeDeep(base, override)).toEqual({ a: 1, b: 2, nested: { x: 1, y: 3 } })
  })

  it('reemplaza arrays y escalares en vez de fusionarlos', () => {
    const base = { list: [1, 2, 3], value: 'old' }
    const override = { list: [9], value: 'new' }

    expect(mergeDeep(base, override)).toEqual({ list: [9], value: 'new' })
  })

  it('no muta el objeto base', () => {
    const base = { nested: { x: 1 } }
    const result = mergeDeep(base, { nested: { y: 2 } })

    expect(base).toEqual({ nested: { x: 1 } })
    expect(result).toEqual({ nested: { x: 1, y: 2 } })
  })
})

describe('loadSeedData', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'seed-data-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('carga el archivo base cuando no hay override', () => {
    writeFileSync(join(dir, 'commerce.json'), JSON.stringify({ branches: 3 }))

    expect(loadSeedData('commerce', { baseDir: dir })).toEqual({ branches: 3 })
  })

  it('fusiona el override del entorno sobre la base', () => {
    writeFileSync(join(dir, 'commerce.json'), JSON.stringify({ branches: 3, hours: '09:00' }))
    writeFileSync(join(dir, 'commerce.production.json'), JSON.stringify({ branches: 10 }))

    expect(loadSeedData('commerce', { baseDir: dir, env: 'production' })).toEqual({
      branches: 10,
      hours: '09:00',
    })
  })

  it('lleva campos anidados del override con merge profundo', () => {
    writeFileSync(
      join(dir, 'commerce.json'),
      JSON.stringify({ branch: { name: 'Centro', hours: { open: '09:00' } } }),
    )
    writeFileSync(
      join(dir, 'commerce.test.json'),
      JSON.stringify({ branch: { hours: { close: '23:00' } } }),
    )

    expect(loadSeedData('commerce', { baseDir: dir, env: 'test' })).toEqual({
      branch: { name: 'Centro', hours: { open: '09:00', close: '23:00' } },
    })
  })

  it('lanza error si no existe el archivo base', () => {
    expect(() => loadSeedData('missing', { baseDir: dir })).toThrow(/not found/)
  })

  it('permite override por SEED_ENV a través del entorno', () => {
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ users: 2 }))
    writeFileSync(join(dir, 'auth.staging.json'), JSON.stringify({ users: 5 }))
    process.env.SEED_ENV = 'staging'

    try {
      expect(loadSeedData('auth', { baseDir: dir })).toEqual({ users: 5 })
    } finally {
      delete process.env.SEED_ENV
    }
  })

  it('ignora override cuando el directorio del entorno no existe', () => {
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ users: 2 }))
    mkdirSync(join(dir, 'empty'))

    expect(loadSeedData('auth', { baseDir: dir, env: 'doesnotexist' })).toEqual({ users: 2 })
  })
})
