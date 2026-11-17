import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderReview, OrderReviewDocument } from '../../order-review/order-review.model'
import type { PlannedOrderReview } from './demo-review.factory'

@Injectable()
export class DemoReviewsRepository {
  constructor(
    @InjectModel(OrderReview.name)
    private readonly model: Model<OrderReviewDocument>,
  ) {}

  /**
   * Inserta reseñas con fecha histórica.
   *
   * Usa la colección nativa para preservar `createdAt` y `updatedAt` posteriores
   * a la entrega de cada pedido demo.
   */
  async insert(planned: PlannedOrderReview[]): Promise<number> {
    if (planned.length === 0) return 0

    const documents = planned.map((review) => ({
      _id: new Types.ObjectId(),
      orderId: review.orderId,
      customerId: review.customerId,
      branchId: review.branchId,
      branchRating: review.branchRating,
      branchComment: review.branchComment,
      courierId: review.courierId,
      courierRating: review.courierRating,
      courierComment: review.courierComment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }))

    await this.model.collection.insertMany(documents)
    return documents.length
  }

  async deleteByOrderIds(orderIds: string[]): Promise<number> {
    if (orderIds.length === 0) return 0

    const result = await this.model.deleteMany({ orderId: { $in: orderIds } }).exec()
    return result.deletedCount ?? 0
  }
}
