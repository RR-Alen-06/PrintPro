import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecurringBillsService } from './recurring-bills.service';
import { RecurringBillsController } from './recurring-bills.controller';
import {
  RecurringBill,
  RecurringBillSchema,
} from '../schemas/recurring-bill.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecurringBill.name, schema: RecurringBillSchema },
    ]),
    AuthModule,
  ],
  controllers: [RecurringBillsController],
  providers: [RecurringBillsService],
  exports: [RecurringBillsService],
})
export class RecurringBillsModule {}
