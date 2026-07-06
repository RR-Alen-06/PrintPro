import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { WalletTransaction, WalletTransactionSchema } from '../schemas/wallet-transaction.schema';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
    AuthModule,
    JobsModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
