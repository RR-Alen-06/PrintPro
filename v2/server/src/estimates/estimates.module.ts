import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EstimatesService } from './estimates.service';
import { EstimatesController } from './estimates.controller';
import { Estimate, EstimateSchema } from '../schemas/estimate.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Bill, BillSchema } from '../schemas/bill.schema';
import { BillingModule } from '../billing/billing.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Estimate.name, schema: EstimateSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Bill.name, schema: BillSchema },
    ]),
    BillingModule,
    AuthModule,
  ],
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
