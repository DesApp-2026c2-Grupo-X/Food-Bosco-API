import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { env } from '../env'

@Module({
  imports: [MongooseModule.forRoot(env.mongoUri)],
})
export class DatabaseModule {}
