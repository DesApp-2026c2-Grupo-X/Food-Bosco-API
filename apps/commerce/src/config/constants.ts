export const ROLES = {
  customer: 'customer',
  branchAdmin: 'branch_admin',
  superAdmin: 'super_admin',
  rider: 'rider',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_VALUES: Role[] = [ROLES.customer, ROLES.branchAdmin, ROLES.superAdmin, ROLES.rider]

export const ORDER_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  preparing: 'preparing',
  readyForDelivery: 'ready_for_delivery',
  onTheWay: 'on_the_way',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  ORDER_STATUS.pending,
  ORDER_STATUS.confirmed,
  ORDER_STATUS.preparing,
  ORDER_STATUS.readyForDelivery,
  ORDER_STATUS.onTheWay,
  ORDER_STATUS.delivered,
  ORDER_STATUS.cancelled,
]

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.pending]: [ORDER_STATUS.confirmed, ORDER_STATUS.cancelled],
  [ORDER_STATUS.confirmed]: [ORDER_STATUS.preparing, ORDER_STATUS.cancelled],
  [ORDER_STATUS.preparing]: [ORDER_STATUS.readyForDelivery, ORDER_STATUS.cancelled],
  [ORDER_STATUS.readyForDelivery]: [ORDER_STATUS.onTheWay, ORDER_STATUS.cancelled],
  [ORDER_STATUS.onTheWay]: [ORDER_STATUS.delivered, ORDER_STATUS.cancelled],
  [ORDER_STATUS.delivered]: [],
  [ORDER_STATUS.cancelled]: [],
}

export const CART_STATUS = {
  active: 'active',
  confirmed: 'confirmed',
} as const

export type CartStatus = (typeof CART_STATUS)[keyof typeof CART_STATUS]

export const CART_STATUS_VALUES: CartStatus[] = [CART_STATUS.active, CART_STATUS.confirmed]

export const CONFIG_GROUP_TYPE = {
  single: 'single',
  multiple: 'multiple',
} as const

export type ConfigGroupType = (typeof CONFIG_GROUP_TYPE)[keyof typeof CONFIG_GROUP_TYPE]

export const CONFIG_GROUP_TYPE_VALUES: ConfigGroupType[] = [
  CONFIG_GROUP_TYPE.single,
  CONFIG_GROUP_TYPE.multiple,
]

export const STOCK_MOVEMENT_REASON = {
  adjust: 'adjust',
  preparing: 'preparing',
} as const

export type StockMovementReason = (typeof STOCK_MOVEMENT_REASON)[keyof typeof STOCK_MOVEMENT_REASON]

export const PARAMETER_KEYS = {
  maxDistanceKm: 'MAX_DISTANCE_KM',
  basePrepMin: 'BASE_PREP_MIN',
  avgSpeedKmh: 'AVG_SPEED_KMH',
} as const

export const ERROR_CODES = {
  categoryNotFound: 'CATEGORY_NOT_FOUND',
  productNotFound: 'PRODUCT_NOT_FOUND',
  configGroupNotFound: 'CONFIG_GROUP_NOT_FOUND',
  configOptionNotFound: 'CONFIG_OPTION_NOT_FOUND',
  recipeItemNotFound: 'RECIPE_ITEM_NOT_FOUND',
  ingredientNotFound: 'INGREDIENT_NOT_FOUND',
  ingredientInUse: 'INGREDIENT_IN_USE',
  promotionNotFound: 'PROMOTION_NOT_FOUND',
  branchNotFound: 'BRANCH_NOT_FOUND',
  noBranchAvailable: 'NO_BRANCH_AVAILABLE',
  cartNotFound: 'CART_NOT_FOUND',
  cartConfirmed: 'CART_CONFIRMED',
  cartItemNotFound: 'CART_ITEM_NOT_FOUND',
  productUnavailable: 'PRODUCT_UNAVAILABLE',
  orderNotFound: 'ORDER_NOT_FOUND',
  invalidTransition: 'INVALID_TRANSITION',
  insufficientStock: 'INSUFFICIENT_STOCK',
  stockNotFound: 'STOCK_NOT_FOUND',
  parameterNotFound: 'PARAMETER_NOT_FOUND',
  invalidParameterValue: 'INVALID_PARAMETER_VALUE',
  orderStateNotFound: 'ORDER_STATE_NOT_FOUND',
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
