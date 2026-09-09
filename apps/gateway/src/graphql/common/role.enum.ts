import { registerEnumType } from '@nestjs/graphql'

export enum Role {
  CUSTOMER = 'CUSTOMER',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  RIDER = 'RIDER',
}

registerEnumType(Role, { name: 'Role' })

const ROLE_BY_STRING: Record<string, Role> = {
  customer: Role.CUSTOMER,
  branch_admin: Role.BRANCH_ADMIN,
  super_admin: Role.SUPER_ADMIN,
  rider: Role.RIDER,
}

export const roleToRest = (role: Role): string => role.toLowerCase()

export const roleFromRest = (value: string): Role => {
  const role = ROLE_BY_STRING[value]
  if (!role) {
    throw new Error(`Unknown role: ${value}`)
  }
  return role
}
