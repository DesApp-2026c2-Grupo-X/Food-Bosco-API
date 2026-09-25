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
  imageRequired: 'IMAGE_REQUIRED',
  payloadTooLarge: 'PAYLOAD_TOO_LARGE',
  internal: 'INTERNAL_SERVER_ERROR',
} as const

export const HEADERS = {
  authorization: 'authorization',
  userId: 'x-user-id',
  roles: 'x-user-roles',
  branchId: 'x-branch-id',
  requestId: 'x-request-id',
  internalToken: 'x-internal-token',
} as const
