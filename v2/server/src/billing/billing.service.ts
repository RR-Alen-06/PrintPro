import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bill } from '../schemas/bill.schema';
import { Customer } from '../schemas/customer.schema';
import { Payment } from '../schemas/payment.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';

export class CreateBillItem {
  name!: string;
  qty!: number;
  unitPrice!: number;
  discountValue?: number;
  discountType?: string;
  gstRate?: number;
}

export class CreateBillDto {
  customerId!: string;
  items!: CreateBillItem[];
  discountValue?: number;
  discountType?: string;
  loyaltyDiscount?: number;
  rounding?: number;
  amountPaid?: number;
  advanceUsed?: number;
  date?: string;
  dueDate?: string;
  cashPaid?: number;
  upiPaid?: number;
}

export class CreateGroupInvoiceMemberDto {
  customerId!: string;
  items!: CreateBillItem[];
  discountValue?: number;
  discountType?: string;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscount?: number;
  useAdvance?: boolean;
  customGst?: number;
  cashPaid?: number;
  upiPaid?: number;
}

export class CreateGroupInvoiceDto {
  mode!: 'shared' | 'split';
  date!: string;
  dueDate?: string;
  notes?: string;
  members!: CreateGroupInvoiceMemberDto[];
}

import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(WalletTransaction.name) private readonly walletTransactionModel: Model<WalletTransaction>,
    private readonly jobsService: JobsService,
  ) {}

  async getInvoices(businessId: string): Promise<Bill[]> {
    const bId = new Types.ObjectId(businessId);
    return this.billModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getInvoice(businessId: string, id: string): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const invoice = await this.billModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
  }

  async createInvoice(businessId: string, data: CreateBillDto): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(data.customerId);

    // 1. Verify Customer exists
    const customer = await this.customerModel
      .findOne({ _id: cId, businessId: bId })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    // 2. Generate sequential Bill No
    const billCount = await this.billModel
      .countDocuments({ businessId: bId })
      .exec();
    const billNo = `BILL-${String(billCount + 1).padStart(4, '0')}`;

    // 3. Compute Financial Totals (Parity calculation matching V1)
    const items = data.items || [];
    let itemsSubtotal = 0;

    const computedItems = items.map((item) => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const itemDiscVal = Number(item.discountValue || 0);
      const itemDiscType = item.discountType || 'flat';

      const subtotal = qty * unitPrice;
      let discountAmount = 0;

      if (itemDiscType === 'percent') {
        discountAmount = Number(((subtotal * itemDiscVal) / 100).toFixed(2));
      } else {
        discountAmount = Math.min(itemDiscVal, subtotal);
      }

      const netSubtotal = Math.max(
        0,
        Number((subtotal - discountAmount).toFixed(2)),
      );
      itemsSubtotal += netSubtotal;

      const gstRate = Number(item.gstRate || 0);
      const lineGst = Number(((netSubtotal * gstRate) / 100).toFixed(2));

      return {
        name: item.name,
        qty,
        unitPrice,
        subtotal,
        discountValue: itemDiscVal,
        discountType: itemDiscType,
        discountAmount,
        netSubtotal,
        gstRate,
        lineGst,
        lineTotal: Number((netSubtotal + lineGst).toFixed(2)),
      };
    });

    // Invoice level discount
    const discountValue = Number(data.discountValue || 0);
    const discountType = data.discountType || 'flat';
    let invoiceDiscount = 0;

    if (discountValue > 0) {
      if (discountType === 'percent') {
        invoiceDiscount = Number(
          ((itemsSubtotal * discountValue) / 100).toFixed(2),
        );
      } else {
        invoiceDiscount = Math.min(discountValue, itemsSubtotal);
      }
    }

    const calculatedSubtotal = computedItems.reduce(
      (s, item) => s + item.subtotal,
      0,
    );
    const calculatedItemDiscount = computedItems.reduce(
      (s, item) => s + item.discountAmount,
      0,
    );
    const finalTotalDiscount = calculatedItemDiscount + invoiceDiscount;
    const computedGstAmount = computedItems.reduce(
      (s, item) => s + item.lineGst,
      0,
    );

    const loyaltyDiscount = Number(data.loyaltyDiscount || 0);
    const rounding = Number(data.rounding || 0);
    const rawTotal = Math.max(
      0,
      calculatedSubtotal -
        finalTotalDiscount +
        computedGstAmount -
        loyaltyDiscount,
    );
    const total = Number((rawTotal + rounding).toFixed(2));

    const amountPaid = Number(data.amountPaid || 0);
    const balance = Math.max(0, Number((total - amountPaid).toFixed(2)));
    const status =
      amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

    // 4. Update Customer balances & loyalty points if applicable
    const advanceUsed = Number(data.advanceUsed || 0);
    if (advanceUsed > 0) {
      if (customer.advanceBalance < advanceUsed) {
        throw new BadRequestException('Insufficient advance credit balance.');
      }
      customer.advanceBalance = Number(
        (customer.advanceBalance - advanceUsed).toFixed(2),
      );
      customer.creditBalance = customer.advanceBalance;
    }

    // Add any outstanding dues to the customer's credit balance
    if (balance > 0) {
      customer.creditBalance = Number(
        (customer.creditBalance + balance).toFixed(2),
      );
    }

    // Add loyalty points if program is enabled
    const pointsEarned = Math.floor(total / 30);
    customer.loyaltyPoints += pointsEarned;
    await customer.save();

    // 5. Create Bill Document
    const bill = new this.billModel({
      billNo,
      customerId: cId,
      customerName: customer.name,
      date: data.date || new Date().toISOString().slice(0, 10),
      dueDate: data.dueDate,
      subtotal: Number(calculatedSubtotal.toFixed(2)),
      discountAmount: Number(finalTotalDiscount.toFixed(2)),
      discountType,
      discountValue,
      gstAmount: Number(computedGstAmount.toFixed(2)),
      total,
      amountPaid,
      balance,
      status,
      advanceUsed,
      items: computedItems,
      businessId: bId,
    });
    const savedBill = await bill.save();

    if (advanceUsed > 0) {
      const transaction = new this.walletTransactionModel({
        businessId: bId,
        customerId: cId,
        amount: -advanceUsed,
        type: 'purchase',
        referenceId: savedBill._id,
        notes: `Paid invoice ${billNo} using wallet balance`,
      });
      await transaction.save();
    }

    // 6. Create Payment Record if amountPaid > 0
    if (amountPaid > 0) {
      const pCount = await this.paymentModel
        .countDocuments({ businessId: bId })
        .exec();
      const paymentNo = `PAY-${String(pCount + 1).padStart(4, '0')}`;

      const payment = new this.paymentModel({
        paymentNo,
        billId: savedBill._id,
        customerId: cId,
        date: data.date || new Date().toISOString().slice(0, 10),
        totalPaid: amountPaid,
        cashAmount: Number(data.cashPaid || amountPaid),
        upiAmount: Number(data.upiPaid || 0),
        paymentType: 'payment',
        businessId: bId,
        notes: `Initial payment for invoice ${billNo}`,
      });
      await payment.save();
    }

    // 7. Auto-create Production Job tracking card
    try {
      await this.jobsService.createJobFromBill(businessId, savedBill);
    } catch (e) {
      console.error('Failed to create job tracking card:', e);
    }

    return savedBill;
  }

  async createGroupInvoice(
    businessId: string,
    data: CreateGroupInvoiceDto,
  ): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    if (!data.members || data.members.length === 0) {
      throw new BadRequestException(
        'Group invoice must contain at least one member.',
      );
    }

    const groupBillId = new Types.ObjectId().toString();
    const dateStr = data.date || new Date().toISOString().slice(0, 10);

    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    let totalAmount = 0;
    let totalPaid = 0;

    const childBills: Bill[] = [];

    // Process each member
    for (const member of data.members) {
      const cId = new Types.ObjectId(member.customerId);
      const customer = await this.customerModel
        .findOne({ _id: cId, businessId: bId })
        .exec();
      if (!customer) {
        throw new NotFoundException(`Customer ${member.customerId} not found.`);
      }

      // Generate child bill number
      const billCount =
        (await this.billModel.countDocuments({ businessId: bId }).exec()) +
        childBills.length;
      const billNo = `BILL-${String(billCount + 1).padStart(4, '0')}`;

      // Compute items
      let memberSubtotal = 0;
      const computedItems = (member.items || []).map((item) => {
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const sub = qty * unitPrice;
        memberSubtotal += sub;

        const gstRate = Number(item.gstRate || 0);
        const lineGst = Number(((sub * gstRate) / 100).toFixed(2));

        return {
          name: item.name,
          qty,
          unitPrice,
          subtotal: sub,
          discountValue: 0,
          discountType: 'flat',
          discountAmount: 0,
          netSubtotal: sub,
          gstRate,
          lineGst,
          lineTotal: Number((sub + lineGst).toFixed(2)),
        };
      });

      // Member level discount
      const discountValue = Number(member.discountValue || 0);
      const discountType = member.discountType || 'flat';
      let memberDiscount = 0;
      if (discountValue > 0) {
        if (discountType === 'percent') {
          memberDiscount = Number(
            ((memberSubtotal * discountValue) / 100).toFixed(2),
          );
        } else {
          memberDiscount = Math.min(discountValue, memberSubtotal);
        }
      }

      const loyaltyDiscount = Number(member.loyaltyDiscount || 0);
      const gstAmount =
        member.customGst !== undefined
          ? Number(member.customGst)
          : computedItems.reduce((s, i) => s + i.lineGst, 0);

      const total = Math.max(
        0,
        Number(
          (
            memberSubtotal +
            gstAmount -
            memberDiscount -
            loyaltyDiscount
          ).toFixed(2),
        ),
      );

      // Advance payment settlement
      let advanceUsed = 0;
      let amountPaid =
        Number(member.cashPaid || 0) + Number(member.upiPaid || 0);
      if (member.useAdvance) {
        advanceUsed = Math.min(customer.advanceBalance, total - amountPaid);
        if (advanceUsed > 0) {
          customer.advanceBalance = Number(
            (customer.advanceBalance - advanceUsed).toFixed(2),
          );
          customer.creditBalance = customer.advanceBalance;
          amountPaid += advanceUsed;
        }
      }

      const balance = Math.max(0, Number((total - amountPaid).toFixed(2)));
      const status =
        amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

      // Record outstanding due
      if (balance > 0) {
        customer.creditBalance = Number(
          (customer.creditBalance + balance).toFixed(2),
        );
      }

      // Redeem loyalty points
      if (member.loyaltyPointsRedeemed && member.loyaltyPointsRedeemed > 0) {
        customer.loyaltyPoints = Math.max(
          0,
          customer.loyaltyPoints - member.loyaltyPointsRedeemed,
        );
      }

      // Add new loyalty points
      const pointsEarned = Math.floor(total / 30);
      customer.loyaltyPoints += pointsEarned;
      await customer.save();

      // Create child Bill
      const childBill = new this.billModel({
        billNo,
        customerId: cId,
        customerName: customer.name,
        date: dateStr,
        dueDate: data.dueDate,
        subtotal: Number(memberSubtotal.toFixed(2)),
        discountAmount: Number(memberDiscount.toFixed(2)),
        discountType,
        discountValue,
        gstAmount: Number(gstAmount.toFixed(2)),
        total,
        amountPaid,
        balance,
        status,
        items: computedItems,
        businessId: bId,
        isGroupParent: false,
        groupBillId,
      });
      const savedChild = await childBill.save();
      childBills.push(savedChild);

      // Create Payment log if any cash/upi was paid
      const cashPaid = Number(member.cashPaid || 0);
      const upiPaid = Number(member.upiPaid || 0);
      if (cashPaid > 0 || upiPaid > 0 || advanceUsed > 0) {
        const pCount = await this.paymentModel
          .countDocuments({ businessId: bId })
          .exec();
        const paymentNo = `PAY-${String(pCount + 1).padStart(4, '0')}`;

        const payment = new this.paymentModel({
          paymentNo,
          billId: savedChild._id,
          customerId: cId,
          date: dateStr,
          totalPaid: cashPaid + upiPaid + advanceUsed,
          cashAmount: cashPaid + advanceUsed, // Advance counts as cash statement credit
          upiAmount: upiPaid,
          paymentType: 'payment',
          businessId: bId,
          notes: `Group payment settled for child invoice ${billNo}`,
        });
        await payment.save();
      }

      totalSubtotal += memberSubtotal;
      totalDiscount += memberDiscount;
      totalGst += gstAmount;
      totalAmount += total;
      totalPaid += amountPaid;
    }

    // Save Parent Bill representing the Group invoice
    const parentBillCount =
      (await this.billModel.countDocuments({ businessId: bId }).exec()) +
      childBills.length;
    const parentBillNo = `BILL-${String(parentBillCount + 1).padStart(4, '0')}`;

    const parentBill = new this.billModel({
      billNo: parentBillNo,
      customerId: new Types.ObjectId(), // Placeholder ObjectId for parent bill
      customerName: 'Group Billing Parent',
      date: dateStr,
      dueDate: data.dueDate,
      subtotal: Number(totalSubtotal.toFixed(2)),
      discountAmount: Number(totalDiscount.toFixed(2)),
      gstAmount: Number(totalGst.toFixed(2)),
      total: Number(totalAmount.toFixed(2)),
      amountPaid: Number(totalPaid.toFixed(2)),
      balance: Number(Math.max(0, totalAmount - totalPaid).toFixed(2)),
      status:
        totalPaid >= totalAmount
          ? 'paid'
          : totalPaid > 0
            ? 'partial'
            : 'unpaid',
      items: [],
      businessId: bId,
      isGroupParent: true,
      groupBillId,
      notes: data.notes || 'Group consolidated invoice',
    });
    return parentBill.save();
  }

  async getCustomerBills(businessId: string, customerId: string): Promise<Bill[]> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);
    return this.billModel
      .find({ businessId: bId, customerId: cId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getDeletedBills(businessId: string): Promise<Bill[]> {
    const bId = new Types.ObjectId(businessId);
    return this.billModel
      .find({ businessId: bId, deleted: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async softDeleteBill(businessId: string, billId: string): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const bill = await this.billModel
      .findOne({ _id: new Types.ObjectId(billId), businessId: bId })
      .exec();
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.deleted) return bill;

    // 1. Revert loyalty points and advance credit
    const customer = await this.customerModel
      .findOne({ _id: bill.customerId, businessId: bId })
      .exec();

    if (customer) {
      // Revert loyalty points
      const pointsEarned = Math.floor(bill.total / 30);
      customer.loyaltyPoints = Math.max(0, (customer.loyaltyPoints || 0) - pointsEarned);

      // Revert advance used
      const advanceUsed = bill.advanceUsed || 0;
      if (advanceUsed > 0) {
        customer.advanceBalance = Number(((customer.advanceBalance || 0) + advanceUsed).toFixed(2));
        customer.creditBalance = Number(((customer.creditBalance || 0) + advanceUsed).toFixed(2));
      }

      // Revert outstanding balance added to customer's credit balance
      if (bill.balance > 0) {
        customer.creditBalance = Number(
          Math.max(0, (customer.creditBalance || 0) - bill.balance).toFixed(2),
        );
      }

      await customer.save();
    }

    // 2. Remove associated payments
    await this.paymentModel.deleteMany({ billId: bill._id, businessId: bId });

    bill.deleted = true;
    return bill.save();
  }

  async restoreBill(businessId: string, billId: string): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const bill = await this.billModel
      .findOne({ _id: new Types.ObjectId(billId), businessId: bId })
      .exec();
    if (!bill) throw new NotFoundException('Bill not found');
    if (!bill.deleted) return bill;

    // 1. Re-apply loyalty points and advance credit
    const customer = await this.customerModel
      .findOne({ _id: bill.customerId, businessId: bId })
      .exec();

    if (customer) {
      // Re-apply loyalty points
      const pointsEarned = Math.floor(bill.total / 30);
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) + pointsEarned;

      // Re-apply advance used
      const advanceUsed = bill.advanceUsed || 0;
      if (advanceUsed > 0) {
        customer.advanceBalance = Number(
          Math.max(0, (customer.advanceBalance || 0) - advanceUsed).toFixed(2),
        );
        customer.creditBalance = customer.advanceBalance; // Assuming credit matches advance in this flow
      }

      // Re-apply outstanding balance
      if (bill.balance > 0) {
        customer.creditBalance = Number(((customer.creditBalance || 0) + bill.balance).toFixed(2));
      }

      await customer.save();
    }

    // Restore associated payments? Soft-deleted payments are hard to restore if we deleted them.
    // In V1, payments weren't hard deleted. We should probably create a new payment or just leave it.
    // Let's create a new payment if there was amountPaid > 0.
    if (bill.amountPaid > 0) {
      const pCount = await this.paymentModel.countDocuments({ businessId: bId }).exec();
      const paymentNo = `PAY-${String(pCount + 1).padStart(4, '0')}`;
      const payment = new this.paymentModel({
        paymentNo,
        billId: bill._id,
        customerId: bill.customerId,
        date: bill.date,
        totalPaid: bill.amountPaid,
        cashAmount: bill.amountPaid,
        upiAmount: 0,
        paymentType: 'payment',
        businessId: bId,
        notes: `Restored payment for invoice ${bill.billNo}`,
      });
      await payment.save();
    }

    bill.deleted = false;
    return bill.save();
  }

  async searchInvoices(
    businessId: string,
    query: any,
  ): Promise<Bill[]> {
    const bId = new Types.ObjectId(businessId);
    const filter: any = { businessId: bId, deleted: { $ne: true } };

    if (query.q) {
      const regex = new RegExp(query.q, 'i');
      filter.$or = [
        { billNo: regex },
        { customerName: regex },
        { notes: regex },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.dateFrom || query.dateTo) {
      filter.date = {};
      if (query.dateFrom) filter.date.$gte = query.dateFrom;
      if (query.dateTo) filter.date.$lte = query.dateTo;
    }
    if (query.minAmount || query.maxAmount) {
      filter.total = {};
      if (query.minAmount) filter.total.$gte = Number(query.minAmount);
      if (query.maxAmount) filter.total.$lte = Number(query.maxAmount);
    }

    return this.billModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async updateBillMetadata(
    businessId: string,
    billId: string,
    updates: any,
  ): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const bill = await this.billModel
      .findOne({ _id: new Types.ObjectId(billId), businessId: bId })
      .exec();
    if (!bill) throw new NotFoundException('Bill not found');

    if (updates.notes !== undefined) bill.notes = updates.notes;
    if (updates.dueDate !== undefined) bill.dueDate = updates.dueDate;
    if (updates.date !== undefined) bill.date = updates.date;

    return bill.save();
  }
}
