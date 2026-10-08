import { registerDecorator } from 'class-validator'
import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { isConfigGroupCoherent } from '../config-group.rules'
import type { ConfigGroupShape } from '../config-group.rules'

export const IsCoherentConfigGroup =
  (options?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCoherentConfigGroup',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (_value: unknown, args: ValidationArguments): boolean =>
          isConfigGroupCoherent(args.object as ConfigGroupShape),
      },
    })
  }
