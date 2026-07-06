import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bill } from '../schemas/bill.schema';
import { Inventory } from '../schemas/inventory.schema';
import { Customer } from '../schemas/customer.schema';
import { Notification } from '../schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
  ) {}

  async createNotification(
    businessId: string,
    customerId: string,
    type: 'job_status' | 'wallet_alert',
    message: string,
  ): Promise<Notification> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);
    const customer = await this.customerModel.findById(cId).exec();
    const customerName = customer ? customer.name : 'Valued Client';

    const notif = new this.notificationModel({
      businessId: bId,
      customerId: cId,
      customerName,
      type,
      message,
    });
    return notif.save();
  }

  async getNotifications(businessId: string) {
    const notifications = [];
    const bId = new Types.ObjectId(businessId);
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Fetch overdue bills
    const overdueBills = await this.billModel
      .find({
        businessId: bId,
        status: { $ne: 'paid' },
        dueDate: { $lt: todayStr },
        deletedAt: null,
      })
      .limit(20)
      .lean()
      .exec();

    // Attach customer names manually since no strict rel in Mongoose is defined with populate here
    for (const bill of overdueBills) {
      let customerName = 'Customer';
      if (bill.customerId) {
        const cust = await this.customerModel.findById(bill.customerId).lean().exec();
        if (cust) customerName = cust.name;
      }
      notifications.push({
        id: `overdue-${bill._id.toString()}`,
        title: `Overdue: ${bill.billNo || bill._id.toString().substring(0, 8)}`,
        message: `${customerName} owes ₹${(bill.balance || 0).toFixed(2)} — due ${bill.dueDate}`,
        type: 'warning',
        read: false,
        date: todayStr,
      });
    }

    // 2. Fetch low stock items
    const inventory = await this.inventoryModel
      .find({ businessId: bId })
      .lean()
      .exec();

    for (const item of inventory) {
      // V2 Inventory items might not have lowStockAlert explicitly, but if they do:
      const stock = item.currentStock || item.stock || 0;
      const alertLevel = item.reorderLevel || 50;
      
      if (stock <= alertLevel) {
        notifications.push({
          id: `stock-${item._id.toString()}`,
          title: `Low stock: ${item.name}`,
          message: `Only ${stock} units left (alert threshold: ${alertLevel})`,
          type: 'info',
          read: false,
          date: todayStr,
        });
      }
    }

    // 3. Fetch database notifications
    const dbNotifs = await this.notificationModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean()
      .exec();

    dbNotifs.forEach((dn) => {
      notifications.push({
        id: `db-${dn._id.toString()}`,
        title: dn.type === 'job_status' ? 'Print Production Alert' : 'Wallet & Loyalty Alert',
        message: `${dn.customerName}: ${dn.message}`,
        type: dn.type === 'job_status' ? 'success' : 'warning',
        read: dn.read || false,
        date: dn.createdAt.toISOString().slice(0, 10),
      });
    });

    return notifications;
  }
}
