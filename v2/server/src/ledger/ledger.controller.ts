import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get(':customerId')
  getLedger(
    @Request() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
  ) {
    const businessId = req.user.businessId;
    return this.ledgerService.getCustomerLedger(businessId, customerId);
  }
}
