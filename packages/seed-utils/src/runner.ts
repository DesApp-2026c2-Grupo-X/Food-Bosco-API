import { createSeedLogger, type SeedLogger } from './logger'

export interface SeedAppContext {
  get<T>(token: unknown): T
  close(): Promise<unknown>
}

export interface SeedRunnerOptions<TApp extends SeedAppContext> {
  scope?: string
  bootstrap: () => Promise<TApp>
  run: (app: TApp) => Promise<unknown>
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Ejecuta un seed standalone: hace bootstrap del contexto, ejecuta la rutina,
 * maneja errores (exitCode) y cierra el contexto siempre.
 */
export const runSeed = async <TApp extends SeedAppContext>(
  options: SeedRunnerOptions<TApp>,
): Promise<void> => {
  const logger: SeedLogger = createSeedLogger(options.scope)
  const app = await options.bootstrap()

  try {
    await options.run(app)
    logger.success('Seed completado')
  } catch (error: unknown) {
    logger.error(describeError(error))
    process.exitCode = 1
  } finally {
    await app.close()
  }
}
