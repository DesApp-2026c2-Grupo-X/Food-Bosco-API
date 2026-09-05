export interface UpsertableModel {
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { new: true; upsert: true },
  ): { exec(): Promise<unknown> }
}

/**
 * Inserta o actualiza un documento por su clave natural de forma atómica.
 * Evita duplicados en ejecuciones concurrentes (reposa en el índice único).
 */
export const upsertOne = <T>(
  model: UpsertableModel,
  filter: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<T | null> =>
  model
    .findOneAndUpdate(filter, { $set: data }, { new: true, upsert: true })
    .exec() as Promise<T | null>

/**
 * Inserta un documento solo si no existe (clave natural). No modifica el documento
 * si ya estaba presente (`$setOnInsert`): idempotencia total ante re-ejecuciones.
 */
export const insertIfAbsent = <T>(
  model: UpsertableModel,
  filter: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<T | null> =>
  model
    .findOneAndUpdate(filter, { $setOnInsert: data }, { new: true, upsert: true })
    .exec() as Promise<T | null>

export const isDuplicateKeyError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  return (error as { code?: unknown }).code === 11000
}

export class SeedReporter {
  private createdCount = 0
  private skippedCount = 0

  recordCreated(): void {
    this.createdCount += 1
  }

  recordSkipped(): void {
    this.skippedCount += 1
  }

  get created(): number {
    return this.createdCount
  }

  get skipped(): number {
    return this.skippedCount
  }

  summary(): { created: number; skipped: number } {
    return { created: this.createdCount, skipped: this.skippedCount }
  }
}
