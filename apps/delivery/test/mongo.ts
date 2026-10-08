import { MongoMemoryServer } from 'mongodb-memory-server'

const isPortInUse = (error: unknown): boolean =>
  error instanceof Error && /already in use|EADDRINUSE/i.test(error.message)

/**
 * Crea un MongoMemoryServer reintentando ante colisiones de puerto transitorias.
 * `mongodb-memory-server` elige el puerto antes de bindear mongod; bajo carga el
 * puerto puede ocuparse en el medio y mongod falla con "Port ... already in use".
 */
export const createMongoServer = async (attempts = 5): Promise<MongoMemoryServer> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await MongoMemoryServer.create()
    } catch (error) {
      if (!isPortInUse(error) || attempt === attempts) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
    }
  }

  throw new Error('No se pudo iniciar MongoMemoryServer')
}
