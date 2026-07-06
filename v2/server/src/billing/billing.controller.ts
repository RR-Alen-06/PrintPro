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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('search')
  searchInvoices(
    @Request() req: AuthenticatedRequest,
    @Request() request: any,
  ) {
    const businessId = req.user.businessId;
    return this.billingService.searchInvoices(businessId, request.query);
  }

  @Get('deleted')
  getDeletedBills(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.billingService.getDeletedBills(businessId);
  }

  @Get('customer/:customerId/bills')
  getCustomerBills(
    @Request() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
  ) {
    const businessId = req.user.businessId;
    return this.billingService.getCustomerBills(businessId, customerId);
  }

  @Post('invoices/:id/restore')
  @Roles('owner', 'manager')
  restoreBill(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.billingService.restoreBill(businessId, id);
  }

  @Post('invoices/:id/delete') // Or DELETE 'invoices/:id'
  @Roles('owner', 'manager')
  softDeleteBill(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.billingService.softDeleteBill(businessId, id);
  }

  @Post('invoices/:id/metadata')
  updateBillMetadata(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const businessId = req.user.businessId;
    return this.billingService.updateBillMetadata(businessId, id, body);
  }
}
