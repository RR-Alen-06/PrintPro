import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RefundsService, CreateRefundDto } from './refunds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/refunds')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  getRefunds(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.refundsService.getRefunds(businessId);
  }

  @Post()
  createRefund(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateRefundDto,
  ) {
    const businessId = req.user.businessId;
    return this.refundsService.createRefund(businessId, body);
  }
}
