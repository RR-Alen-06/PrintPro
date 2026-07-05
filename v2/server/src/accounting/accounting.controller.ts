import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('transactions')
  getTransactions(
    @Request() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const businessId = req.user.businessId;
    return this.accountingService.getTransactions(
      businessId,
      startDate,
      endDate,
    );
  }

  @Get('summary')
  getPeriodSummary(
    @Request() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const businessId = req.user.businessId;
    return this.accountingService.getPeriodSummary(
      businessId,
      startDate,
      endDate,
    );
  }
}
