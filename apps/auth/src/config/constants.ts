export const ROLES = {
  customer: 'customer',
  branchAdmin: 'branch_admin',
  superAdmin: 'super_admin',
  rider: 'rider',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const USER_ROLE_VALUES: Role[] = [
  ROLES.customer,
  ROLES.branchAdmin,
  ROLES.superAdmin,
  ROLES.rider,
]

export const ERROR_CODES = {
  emailTaken: 'EMAIL_TAKEN',
  invalidCredentials: 'INVALID_CREDENTIALS',
  userInactive: 'USER_INACTIVE',
  userNotFound: 'USER_NOT_FOUND',
  invalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  invalidOrExpiredToken: 'INVALID_OR_EXPIRED_TOKEN',
  addressNotFound: 'ADDRESS_NOT_FOUND',
  validationError: 'VALIDATION_ERROR',
  forbidden: 'FORBIDDEN',
  unauthenticated: 'UNAUTHENTICATED',
  notFound: 'NOT_FOUND',
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
