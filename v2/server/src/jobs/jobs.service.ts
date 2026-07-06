import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job } from '../schemas/job.schema';
import { Customer } from '../schemas/customer.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<Job>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getJobs(businessId: string, role: string, email: string): Promise<Job[]> {
    const bId = new Types.ObjectId(businessId);
    
    if (role === 'customer') {
      // Find the customer record corresponding to the logged in user's email
      const customer = await this.customerModel.findOne({ email, businessId: bId }).exec();
      if (!customer) {
        return []; // No customer found, return empty list
      }
      return this.jobModel
        .find({ businessId: bId, customerId: customer._id, deleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .exec();
    }

    return this.jobModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async createJobFromBill(businessId: string, bill: any): Promise<Job> {
    const bId = new Types.ObjectId(businessId);
    const count = await this.jobModel.countDocuments({ businessId: bId }).exec();
    const jobNo = `JOB-${String(count + 1).padStart(4, '0')}`;

    const job = new this.jobModel({
      jobNo,
      businessId: bId,
      customerId: bill.customerId,
      customerName: bill.customerName,
      billId: bill._id,
      billNo: bill.billNo,
      status: 'pending',
      items: bill.items,
      dueDate: bill.dueDate,
      notes: bill.notes,
    });
    return job.save();
  }

  async updateJobStatus(businessId: string, id: string, status: string, role: string, email: string): Promise<Job> {
    const bId = new Types.ObjectId(businessId);
    
    const job = await this.jobModel.findOne({ _id: new Types.ObjectId(id), businessId: bId }).exec();
    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    // Customer cannot change job status! Only owner/staff can.
    if (role === 'customer') {
      throw new NotFoundException('Access denied.'); // Hide access
    }

    job.status = status;
    const saved = await job.save();

    // Trigger Notification
    try {
      await this.notificationsService.createNotification(
        businessId,
        job.customerId.toString(),
        'job_status',
        `Your print order ${job.jobNo} is now in status: ${status.toUpperCase()}.`,
      );
    } catch (e) {
      console.error('Failed to trigger job update notification:', e);
    }

    return saved;
  }

  async deleteJob(businessId: string, id: string): Promise<Job> {
    const bId = new Types.ObjectId(businessId);
    const job = await this.jobModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: { deleted: true } },
        { new: true },
      )
      .exec();
    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }
}
