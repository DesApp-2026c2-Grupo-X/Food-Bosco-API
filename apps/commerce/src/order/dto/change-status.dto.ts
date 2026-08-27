import { IsIn } from 'class-validator'
import { ORDER_STATUS_VALUES } from '../../config/constants'
import type { OrderStatus } from '../../config/constants'

export class ChangeStatusDto {
  @IsIn(ORDER_STATUS_VALUES)
  status!: OrderStatus
}
