import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvancePaymentsService } from './advance-payments.service';
import { AdvancePaymentsController } from './advance-payments.controller';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdvancePaymentsController],
  providers: [AdvancePaymentsService],
  exports: [AdvancePaymentsService],
})
export class AdvancePaymentsModule {}
