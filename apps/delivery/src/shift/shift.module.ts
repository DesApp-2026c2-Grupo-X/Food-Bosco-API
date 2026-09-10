import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ShiftController } from './shift.controller'
import { Shift, ShiftSchema } from './shift.model'
import { ShiftRepository } from './shift.repository'
import { ShiftService } from './shift.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Shift.name, schema: ShiftSchema }])],
  controllers: [ShiftController],
  providers: [ShiftRepository, ShiftService],
  exports: [ShiftService],
})
export class ShiftModule {}
