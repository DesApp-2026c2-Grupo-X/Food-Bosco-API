import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchStock, BranchStockSchema } from './branch-stock.model'
import { StockMovement, StockMovementSchema } from './stock-movement.model'
import { StockController } from './stock.controller'
import { StockRepository } from './stock.repository'
import { StockService } from './stock.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BranchStock.name, schema: BranchStockSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
  ],
  controllers: [StockController],
  providers: [StockRepository, StockService],
  exports: [StockService],
})
export class StockModule {}
