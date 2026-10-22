import { registerEnumType } from '@nestjs/graphql'

export enum AppName {
  STORE = 'store',
  ADMIN = 'admin',
  BRANCH = 'branch',
  RIDER = 'rider',
}

registerEnumType(AppName, { name: 'AppName' })
