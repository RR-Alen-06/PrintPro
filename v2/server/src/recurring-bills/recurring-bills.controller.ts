import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  RecurringBillsService,
  CreateRecurringBillDto,
} from './recurring-bills.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/recurring-bills')
@UseGuards(JwtAuthGuard)
export class RecurringBillsController {
  constructor(private readonly recurringBillsService: RecurringBillsService) {}

  @Get()
  getRecurringBills(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.recurringBillsService.getRecurringBills(businessId);
  }

  @Post()
  createRecurringBill(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateRecurringBillDto,
  ) {
    const businessId = req.user.businessId;
    return this.recurringBillsService.createRecurringBill(businessId, body);
  }

  @Delete(':id')
  deleteRecurringBill(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const businessId = req.user.businessId;
    return this.recurringBillsService.deleteRecurringBill(businessId, id);
  }
}
