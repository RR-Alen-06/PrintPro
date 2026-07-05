import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from './app.service';
import { User } from './schemas/user.schema';
import { Business } from './schemas/business.schema';
import { Customer } from './schemas/customer.schema';
import { Bill } from './schemas/bill.schema';
import { Payment } from './schemas/payment.schema';
import { Expense } from './schemas/expense.schema';
import * as bcrypt from 'bcrypt';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('seed')
  async seed() {
    // 1. Clear existing collections
    await this.userModel.deleteMany({});
    await this.businessModel.deleteMany({});
    await this.customerModel.deleteMany({});
    await this.billModel.deleteMany({});
    await this.paymentModel.deleteMany({});
    await this.expenseModel.deleteMany({});

    // 2. Create Business
    const business = new this.businessModel({
      shopName: 'Elite Print Studio',
      ownerName: 'Alen Cooper',
      phone: '9876543210',
      address: '123 Tech Park, Bangalore',
      gstin: '29AAAAA1111A1Z1',
      upiId: 'alen@upi',
    });
    const savedBusiness = await business.save();

    // 3. Create User
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = new this.userModel({
      email: 'merchant@printpro.com',
      passwordHash,
      businessId: savedBusiness._id,
      role: 'owner',
    });
    await user.save();

    // 4. Create Customers
    const customer1 = new this.customerModel({
      name: 'John Doe',
      phone: '9999888877',
      email: 'john@gmail.com',
      advanceBalance: 120,
      creditBalance: 120,
      loyaltyPoints: 15,
      type: 'regular',
      businessId: savedBusiness._id,
    });
    const savedC1 = await customer1.save();

    const customer2 = new this.customerModel({
      name: 'Jane Smith',
      phone: '9999666655',
      email: 'jane@gmail.com',
      advanceBalance: 0,
      creditBalance: 0,
      loyaltyPoints: 0,
      type: 'regular',
      businessId: savedBusiness._id,
    });
    const savedC2 = await customer2.save();

    // 5. Create Bills
    // Bill 1: Fully Paid
    const bill1 = new this.billModel({
      billNo: 'BILL-0001',
      customerId: savedC1._id,
      customerName: savedC1.name,
      date: '2026-07-01',
      dueDate: '2026-07-15',
      subtotal: 500,
      discountAmount: 50,
      discountType: 'percent',
      discountValue: 10,
      gstAmount: 81, // 18% of 450
      total: 531,
      amountPaid: 531,
      balance: 0,
      status: 'paid',
      items: [
        {
          name: 'A4 Color Prints',
          qty: 50,
          unitPrice: 10,
          subtotal: 500,
          discountAmount: 50,
          discountValue: 10,
          discountType: 'percent',
          netSubtotal: 450,
          gstRate: 18,
          lineGst: 81,
          lineTotal: 531,
        },
      ],
      businessId: savedBusiness._id,
    });
    await bill1.save();

    // Bill 2: Unpaid / Partial
    const bill2 = new this.billModel({
      billNo: 'BILL-0002',
      customerId: savedC2._id,
      customerName: savedC2.name,
      date: '2026-07-02',
      dueDate: '2026-07-04', // Overdue
      subtotal: 1000,
      discountAmount: 100,
      discountType: 'flat',
      discountValue: 100,
      gstAmount: 162,
      total: 1062,
      amountPaid: 400,
      balance: 662,
      status: 'partial',
      items: [
        {
          name: 'Banner Printing',
          qty: 1,
          unitPrice: 1000,
          subtotal: 1000,
          discountAmount: 100,
          discountValue: 100,
          discountType: 'flat',
          netSubtotal: 900,
          gstRate: 18,
          lineGst: 162,
          lineTotal: 1062,
        },
      ],
      businessId: savedBusiness._id,
    });
    await bill2.save();

    // 6. Create Payments
    const payment1 = new this.paymentModel({
      paymentNo: 'PAY-0001',
      billId: bill1._id,
      customerId: savedC1._id,
      date: '2026-07-01',
      totalPaid: 531,
      cashAmount: 531,
      upiAmount: 0,
      paymentType: 'payment',
      businessId: savedBusiness._id,
    });
    await payment1.save();

    const payment2 = new this.paymentModel({
      paymentNo: 'PAY-0002',
      billId: bill2._id,
      customerId: savedC2._id,
      date: '2026-07-02',
      totalPaid: 400,
      cashAmount: 0,
      upiAmount: 400,
      paymentType: 'payment',
      businessId: savedBusiness._id,
    });
    await payment2.save();

    // 7. Create Expense
    const expense = new this.expenseModel({
      expenseNo: 'EXP-0001',
      category: 'Paper Stock',
      amount: 150,
      cashAmount: 150,
      upiAmount: 0,
      date: '2026-07-03',
      notes: 'Purchased 2 rims of A4 paper',
      businessId: savedBusiness._id,
    });
    await expense.save();

    return {
      message: 'Database seeded successfully',
      credentials: {
        email: 'merchant@printpro.com',
        password: 'password123',
      },
    };
  }
}
