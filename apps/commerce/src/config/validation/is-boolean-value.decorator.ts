import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'
import type { ValidationOptions } from 'class-validator'

/**
 * Validación estricta de un booleano de body JSON frente a
 * `enableImplicitConversion` (bug INT-03).
 *
 * El `ValidationPipe` global coacciona el valor crudo según el `design:type`
 * reflejado: con un tipo `boolean`, `Boolean('false') === true` hace que un
 * string o número inválido pase `@IsBoolean`. Este decorador recupera el valor
 * original desde el objeto de entrada (`obj[key]`, no el ya coaccionado) y lo
 * deja intacto, de modo que `@IsBoolean` sólo acepte `true`/`false` reales:
 * `'false'`, `'true'`, `123`, `'yes'` → 400.
 *
 * Los campos opcionales deben seguir usando `@IsOptional()`.
 */
export const ToBoolean =
  (validationOptions?: ValidationOptions): PropertyDecorator =>
  (target, propertyKey) => {
    Transform(({ obj, key }) => (obj as Record<PropertyKey, unknown>)[key])(target, propertyKey)
    IsBoolean(validationOptions)(target, propertyKey)
  }
