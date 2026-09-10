import { runSeed } from './runner'
import type { SeedAppContext } from './runner'

describe('runSeed', () => {
  it('ejecuta la rutina, loguea éxito y cierra el contexto', async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const run = jest.fn().mockResolvedValue(undefined)
    const app: SeedAppContext = { get: jest.fn(), close }

    await runSeed({ bootstrap: () => Promise.resolve(app), run })

    expect(run).toHaveBeenCalledWith(app)
    expect(close).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBeUndefined()
  })

  it('cierra el contexto y marca exitCode=1 ante un error', async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const run = jest.fn().mockRejectedValue(new Error('boom'))
    const app: SeedAppContext = { get: jest.fn(), close }

    delete process.exitCode
    await runSeed({ bootstrap: () => Promise.resolve(app), run })

    expect(close).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBe(1)
    delete process.exitCode
  })

  it('normaliza errores que no son Error', async () => {
    const close = jest.fn().mockResolvedValue(undefined)
    const run = jest.fn().mockRejectedValue('un string roto')
    const app: SeedAppContext = { get: jest.fn(), close }

    delete process.exitCode
    await runSeed({ bootstrap: () => Promise.resolve(app), run })

    expect(process.exitCode).toBe(1)
    delete process.exitCode
  })
})
