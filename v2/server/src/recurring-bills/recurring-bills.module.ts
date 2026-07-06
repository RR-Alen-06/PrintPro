import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecurringBillsService } from './recurring-bills.service';
import { RecurringBillsController } from './recurring-bills.controller';
import {
  RecurringBill,
  RecurringBillSchema,
} from '../schemas/recurring-bill.schema';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecurringBill.name, schema: RecurringBillSchema },
    ]),
    AuthModule,
    BillingModule,
  ],
  controllers: [RecurringBillsController],
  providers: [RecurringBillsService],
  exports: [RecurringBillsService],
})
export class RecurringBillsModule {}
