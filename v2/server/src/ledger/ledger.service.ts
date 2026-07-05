import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bill } from '../schemas/bill.schema';
import { Payment } from '../schemas/payment.schema';
import { Customer } from '../schemas/customer.schema';

interface LedgerEntry {
  type: string;
  date: string;
  id: string;
  description: string;
  subtext: string;
  debit: number;
  credit: number;
  balance?: number;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
  ) {}

  async getCustomerLedger(businessId: string, customerId: string) {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);

    // Verify customer exists
    const customer = await this.customerModel
      .findOne({ _id: cId, businessId: bId })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    // 1. Fetch active bills (debits)
    const bills = await this.billModel
      .find({
        businessId: bId,
        customerId: cId,
        deleted: { $ne: true },
      })
      .exec();

    // 2. Fetch payments (credits, or debits if refunds)
    const payments = await this.paymentModel
      .find({
        businessId: bId,
        customerId: cId,
      })
      .exec();

    const entries: LedgerEntry[] = [];

    // Map Bills
    bills.forEach((bill) => {
      entries.push({
        type: 'bill',
        date: bill.date,
        id: bill.billNo,
        description: `Invoice #${bill.billNo}`,
        subtext: `${bill.items ? `${bill.items.length} item(s) · ` : ''}${bill.status.toUpperCase()}`,
        debit: bill.total,
        credit: 0,
      });
    });

    // Map Payments & Refunds
    payments.forEach((payment) => {
      const isRefund =
        payment.isRefund ||
        payment.paymentType === 'refund' ||
        payment.totalPaid < 0;
      const amount = Math.abs(payment.totalPaid);

      if (isRefund) {
        entries.push({
          type: 'refund',
          date: payment.date,
          id: payment.paymentNo,
          description: `Refund — Invoice #${payment.billId ? 'BILL' : 'General'}`,
          subtext: payment.notes || 'Reversal Credit',
          debit: amount,
          credit: 0,
        });
      } else {
        entries.push({
          type: payment.paymentType === 'advance' ? 'advance' : 'payment',
          date: payment.date,
          id: payment.paymentNo,
          description:
            payment.paymentType === 'advance'
              ? 'Advance Deposit'
              : `Payment — Invoice`,
          subtext:
            payment.notes ||
            `Cash: ₹${payment.cashAmount.toFixed(2)} · UPI: ₹${payment.upiAmount.toFixed(2)}`,
          debit: 0,
          credit: amount,
        });
      }
    });

    // Chronological Sort (Ascending by Date)
    entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate rolling ledger balance
    let rollingBalance = 0;
    const ledgerEntries = entries.map((entry) => {
      // Ledger balance = Credit - Debit (If negative, it's a debit balance / due)
      rollingBalance = Number(
        (rollingBalance + entry.credit - entry.debit).toFixed(2),
      );
      return {
        ...entry,
        balance: rollingBalance,
      };
    });

    return {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        advanceBalance: customer.advanceBalance,
        creditBalance: customer.creditBalance,
        loyaltyPoints: customer.loyaltyPoints,
      },
      entries: ledgerEntries,
      closingBalance: rollingBalance,
    };
  }
}
