import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ParameterController } from './parameter.controller'
import { Parameter, ParameterSchema } from './parameter.model'
import { ParameterRepository } from './parameter.repository'
import { ParameterService } from './parameter.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Parameter.name, schema: ParameterSchema }])],
  controllers: [ParameterController],
  providers: [ParameterRepository, ParameterService],
  exports: [ParameterService],
})
export class ParameterModule {}
