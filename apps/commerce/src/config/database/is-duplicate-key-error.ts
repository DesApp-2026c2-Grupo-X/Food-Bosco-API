/**
 * Detecta el error de clave duplicada (E11000) de MongoDB/Mongoose.
 * Helper compartido para que cada repositorio traduzca la colisión a un
 * `DomainException` con su código de negocio en lugar de propagar el error crudo.
 */
export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
