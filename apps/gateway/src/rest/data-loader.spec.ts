import { DataLoader } from './data-loader'

type Settled<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }

const allSettled = <T>(promises: Promise<T>[]): Promise<Settled<T>[]> =>
  Promise.all(
    promises.map(async (promise): Promise<Settled<T>> => {
      try {
        return { status: 'fulfilled', value: await promise }
      } catch (reason) {
        return { status: 'rejected', reason }
      }
    }),
  )

describe('DataLoader', () => {
  it('agrupa varias cargas del mismo tick en un único lote (RQ-GW-09)', async () => {
    const batch = jest.fn(async (keys: readonly string[]) => keys.map((key) => `v:${key}`))
    const loader = new DataLoader<string, string>(batch)

    const results = await Promise.all([loader.load('a'), loader.load('b'), loader.load('c')])

    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch).toHaveBeenCalledWith(['a', 'b', 'c'])
    expect(results).toEqual(['v:a', 'v:b', 'v:c'])
  })

  it('no mezcla cargas de ticks distintos (una tanda por tick)', async () => {
    const batch = jest.fn(async (keys: readonly string[]) => keys.map((key) => key))
    const loader = new DataLoader<string, string>(batch)

    await loader.load('a')
    await loader.load('b')
    await loader.load('c')

    expect(batch).toHaveBeenCalledTimes(3)
    expect(batch).toHaveBeenNthCalledWith(1, ['a'])
    expect(batch).toHaveBeenNthCalledWith(2, ['b'])
    expect(batch).toHaveBeenNthCalledWith(3, ['c'])
  })

  it('entrega los resultados en el orden de las keys', async () => {
    const loader = new DataLoader<string, string>(async (keys) => keys.map((key) => `v:${key}`))

    const results = await Promise.all([loader.load('c3'), loader.load('c1'), loader.load('c2')])

    expect(results).toEqual(['v:c3', 'v:c1', 'v:c2'])
  })

  it('rechaza solo las keys cuyo resultado es un Error y resuelve el resto', async () => {
    const failure = new Error('404')
    const loader = new DataLoader<string, string>(async () => ['v:a', failure, 'v:c'])

    const results = await allSettled([loader.load('a'), loader.load('b'), loader.load('c')])

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'v:a' })
    expect(results[1]).toEqual({ status: 'rejected', reason: failure })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'v:c' })
  })

  it('si el batch lanza, rechaza todas las keys con ese error', async () => {
    const failure = new Error('boom')
    const loader = new DataLoader<string, string>(async () => {
      throw failure
    })

    const results = await allSettled([loader.load('a'), loader.load('b')])

    expect(results).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ])
  })

  it('si el batch lanza un valor no-Error, lo envuelve en Error', async () => {
    const loader = new DataLoader<string, string>(async () => {
      throw 'boom-string'
    })

    const results = await allSettled([loader.load('a')])

    expect(results[0].status).toBe('rejected')
    expect((results[0] as { reason: Error }).reason).toBeInstanceOf(Error)
    expect((results[0] as { reason: Error }).reason.message).toBe('boom-string')
  })

  it('vuelve a agendar un nuevo lote después de completar el anterior', async () => {
    const batch = jest.fn(async (keys: readonly string[]) => keys.map((key) => key))
    const loader = new DataLoader<string, string>(batch)

    await loader.load('a')
    await loader.load('b')

    expect(batch).toHaveBeenCalledTimes(2)
  })

  it('NO deduplica keys repetidas dentro del mismo lote', async () => {
    const batch = jest.fn(async (keys: readonly string[]) => keys.map((key) => `v:${key}`))
    const loader = new DataLoader<string, string>(batch)

    const results = await Promise.all([loader.load('x'), loader.load('x'), loader.load('x')])

    // KNOWN BUG (RQ-GW-09): DataLoader agrupa por tick pero no deduplica keys;
    // la misma key se envía repetida al batchLoadFn y se pide N veces al servicio REST.
    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch).toHaveBeenCalledWith(['x', 'x', 'x'])
    expect(results).toEqual(['v:x', 'v:x', 'v:x'])
  })
})
