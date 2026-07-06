import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';

import { Bill, BillSchema } from '../schemas/bill.schema';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { Inventory, InventorySchema } from '../schemas/inventory.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Settings, SettingsSchema } from '../schemas/settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Business.name, schema: BusinessSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Settings.name, schema: SettingsSchema },
    ]),
  ],
  controllers: [DataManagementController],
  providers: [DataManagementService],
})
export class DataManagementModule {}
