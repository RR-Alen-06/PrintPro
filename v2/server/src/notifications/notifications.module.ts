import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { Inventory, InventorySchema } from '../schemas/inventory.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Notification, NotificationSchema } from '../schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
