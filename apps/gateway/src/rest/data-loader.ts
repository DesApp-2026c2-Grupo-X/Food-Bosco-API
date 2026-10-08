export type BatchLoadFn<K, V> = (keys: readonly K[]) => Promise<Array<V | Error>>

interface Pending<K, V> {
  key: K
  resolve: (value: V) => void
  reject: (error: Error) => void
}

export class DataLoader<K, V> {
  private queue: Array<Pending<K, V>> = []
  private scheduled = false

  constructor(private readonly batchLoadFn: BatchLoadFn<K, V>) {}

  load(key: K): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      this.queue.push({ key, resolve, reject })
      this.schedule()
    })
  }

  private schedule(): void {
    if (this.scheduled) {
      return
    }

    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      void this.dispatch()
    })
  }

  private async dispatch(): Promise<void> {
    const batch = this.queue
    this.queue = []

    const seen = new Set<K>()
    const uniqueKeys = batch.reduce<K[]>((keys, entry) => {
      if (!seen.has(entry.key)) {
        seen.add(entry.key)
        keys.push(entry.key)
      }
      return keys
    }, [])

    try {
      const results = await this.batchLoadFn(uniqueKeys)
      const resultsByKey = new Map<K, V | Error>()
      uniqueKeys.forEach((key, index) => resultsByKey.set(key, results[index]))

      batch.forEach((entry) => {
        const result = resultsByKey.get(entry.key)
        if (result instanceof Error) {
          entry.reject(result)
        } else {
          entry.resolve(result as V)
        }
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      batch.forEach((entry) => entry.reject(err))
    }
  }
}
