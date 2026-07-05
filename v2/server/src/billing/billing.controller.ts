import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  BillingService,
  CreateBillDto,
  CreateGroupInvoiceDto,
} from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  getInvoices(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.billingService.getInvoices(businessId);
  }

  @Get('invoices/:id')
  getInvoice(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.billingService.getInvoice(businessId, id);
  }

  @Post('invoice')
  createInvoice(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateBillDto,
  ) {
    const businessId = req.user.businessId;
    return this.billingService.createInvoice(businessId, body);
  }

  @Post('group-invoice')
  createGroupInvoice(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateGroupInvoiceDto,
  ) {
    const businessId = req.user.businessId;
    return this.billingService.createGroupInvoice(businessId, body);
  }
}
