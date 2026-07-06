import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { SettingsModule } from './settings/settings.module';
import { LedgerModule } from './ledger/ledger.module';
import { InventoryModule } from './inventory/inventory.module';
import { BillingModule } from './billing/billing.module';
import { AdvancePaymentsModule } from './advance-payments/advance-payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { RefundsModule } from './refunds/refunds.module';
import { AccountingModule } from './accounting/accounting.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecurringBillsModule } from './recurring-bills/recurring-bills.module';
import { User, UserSchema } from './schemas/user.schema';
import { Business, BusinessSchema } from './schemas/business.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { Bill, BillSchema } from './schemas/bill.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { Settings, SettingsSchema } from './schemas/settings.schema';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import {
  RecurringBill,
  RecurringBillSchema,
} from './schemas/recurring-bill.schema';
import { DataManagementModule } from './data-management/data-management.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/printpro-v2',
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Business.name, schema: BusinessSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Bill.name, schema: BillSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Settings.name, schema: SettingsSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: RecurringBill.name, schema: RecurringBillSchema },
    ]),
    AuthModule,
    DashboardModule,
    CustomersModule,
    SettingsModule,
    LedgerModule,
    InventoryModule,
    BillingModule,
    AdvancePaymentsModule,
    ExpensesModule,
    RefundsModule,
    AccountingModule,
    AnalyticsModule,
    RecurringBillsModule,
    DataManagementModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
