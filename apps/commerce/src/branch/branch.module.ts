import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ParameterModule } from '../parameter/parameter.module'
import { ProductModule } from '../product/product.module'
import { BranchController } from './branch.controller'
import { BranchOrchestrator } from './branch.orchestrator'
import { Branch, BranchSchema } from './branch.model'
import {
  BranchProductAvailability,
  BranchProductAvailabilitySchema,
} from './branch-product-availability.model'
import { BranchRepository } from './branch.repository'
import { BranchService } from './branch.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: BranchProductAvailability.name, schema: BranchProductAvailabilitySchema },
    ]),
    ParameterModule,
    ProductModule,
  ],
  controllers: [BranchController],
  providers: [BranchRepository, BranchService, BranchOrchestrator],
  exports: [BranchService, BranchOrchestrator],
})
export class BranchModule {}
