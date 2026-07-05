import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
