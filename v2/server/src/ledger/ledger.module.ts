import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    AuthModule,
  ],
  controllers: [LedgerController],
  providers: [LedgerService],
})
export class LedgerModule {}
