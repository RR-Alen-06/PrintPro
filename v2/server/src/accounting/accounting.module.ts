import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Bill.name, schema: BillSchema },
    ]),
    AuthModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
