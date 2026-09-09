import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { StockMovementReason } from '../config/constants'
import { BranchStock, BranchStockDocument } from './branch-stock.model'
import { StockMovement, StockMovementDocument } from './stock-movement.model'

export interface CreateMovementData {
  branchId: string
  ingredientId: string
  delta: number
  reason: StockMovementReason
  orderId?: string | null
}

@Injectable()
export class StockRepository {
  constructor(
    @InjectModel(BranchStock.name) private readonly stockModel: Model<BranchStockDocument>,
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovementDocument>,
  ) {}

  list(branchId?: string): Promise<BranchStockDocument[]> {
    const filter = branchId ? { branchId } : {}
    return this.stockModel.find(filter).sort({ ingredientId: 1 }).exec()
  }

  findOne(branchId: string, ingredientId: string): Promise<BranchStockDocument | null> {
    return this.stockModel.findOne({ branchId, ingredientId }).exec()
  }

  setQuantity(
    branchId: string,
    ingredientId: string,
    quantity: number,
  ): Promise<BranchStockDocument | null> {
    return this.stockModel
      .findOneAndUpdate(
        { branchId, ingredientId },
        { $set: { quantity } },
        { new: true, upsert: true },
      )
      .exec()
  }

  createMovement(data: CreateMovementData): Promise<StockMovementDocument> {
    return this.movementModel.create({ ...data, orderId: data.orderId ?? null })
  }
}
