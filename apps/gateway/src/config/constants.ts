export const ROLES = {
  customer: 'customer',
  branchAdmin: 'branch_admin',
  superAdmin: 'super_admin',
  rider: 'rider',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ERROR_CODES = {
  unauthenticated: 'UNAUTHENTICATED',
  forbidden: 'FORBIDDEN',
  badRequest: 'BAD_REQUEST',
  internal: 'INTERNAL_SERVER_ERROR',
} as const

export const HEADERS = {
  authorization: 'authorization',
  userId: 'x-user-id',
  roles: 'x-user-roles',
  branchId: 'x-branch-id',
  requestId: 'x-request-id',
} as const
