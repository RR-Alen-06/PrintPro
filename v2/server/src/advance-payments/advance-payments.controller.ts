import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  AdvancePaymentsService,
  CreateAdvanceDto,
} from './advance-payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/advance-payments')
@UseGuards(JwtAuthGuard)
export class AdvancePaymentsController {
  constructor(
    private readonly advancePaymentsService: AdvancePaymentsService,
  ) {}

  @Get()
  getAdvances(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.advancePaymentsService.getAdvances(businessId);
  }

  @Post()
  createAdvance(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateAdvanceDto,
  ) {
    const businessId = req.user.businessId;
    return this.advancePaymentsService.createAdvance(businessId, body);
  }
}
