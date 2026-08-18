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

    try {
      const results = await this.batchLoadFn(batch.map((entry) => entry.key))
      batch.forEach((entry, index) => {
        const result = results[index]
        if (result instanceof Error) {
          entry.reject(result)
        } else {
          entry.resolve(result)
        }
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      batch.forEach((entry) => entry.reject(err))
    }
  }
}
