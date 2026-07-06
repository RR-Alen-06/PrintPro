import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecurringBill } from '../schemas/recurring-bill.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from '../billing/billing.service';

export class CreateRecurringBillDto {
  customerId!: string;
  amount!: number;
  frequency!: string;
  dayOfMonth!: number;
  startDate!: string;
  active!: boolean;
  description?: string;
}

@Injectable()
export class RecurringBillsService {
  constructor(
    @InjectModel(RecurringBill.name)
    private readonly recurringBillModel: Model<RecurringBill>,
    private readonly billingService: BillingService,
  ) {}

  async getRecurringBills(businessId: string): Promise<RecurringBill[]> {
    const bId = new Types.ObjectId(businessId);
    return this.recurringBillModel
      .find({ businessId: bId })
      .populate('customerId', 'name type')
      .exec();
  }

  async createRecurringBill(
    businessId: string,
    data: CreateRecurringBillDto,
  ): Promise<RecurringBill> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(data.customerId);

    const recurring = new this.recurringBillModel({
      ...data,
      customerId: cId,
      businessId: bId,
    });
    return recurring.save();
  }

  async deleteRecurringBill(businessId: string, id: string): Promise<any> {
    const bId = new Types.ObjectId(businessId);
    const rId = new Types.ObjectId(id);

    const result = await this.recurringBillModel
      .deleteOne({ _id: rId, businessId: bId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Recurring bill profile not found.');
    }
    return { success: true };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRecurringCron() {
    const today = new Date();
    const currentDayOfMonth = today.getDate();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...

    // Find all active recurring bills
    const activeProfiles = await this.recurringBillModel.find({ active: true }).exec();

    for (const profile of activeProfiles) {
      try {
        let shouldBill = false;

        if (profile.frequency === 'monthly') {
          if (profile.dayOfMonth === currentDayOfMonth) {
            shouldBill = true;
          }
        } else if (profile.frequency === 'weekly') {
          if (profile.dayOfMonth === currentDayOfWeek) {
            shouldBill = true;
          }
        }

        if (shouldBill) {
          // Generate the invoice atomically
          await this.billingService.createInvoice(profile.businessId.toString(), {
            customerId: profile.customerId.toString(),
            items: [
              {
                name: `Recurring Billing: ${profile.description || 'Monthly Service'}`,
                qty: 1,
                unitPrice: profile.amount,
                discountValue: 0,
                discountType: 'flat',
                gstRate: 0,
              },
            ],
            discountValue: 0,
            discountType: 'flat',
            cashPaid: 0,
            upiPaid: 0,
            advanceUsed: 0,
          });
        }
      } catch (error) {
        console.error(`Failed to process recurring bill profile ${profile._id}:`, error);
      }
    }
  }
}
