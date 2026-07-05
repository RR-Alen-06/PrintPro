import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ExpensesService, CreateExpenseDto } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  getExpenses(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.expensesService.getExpenses(businessId);
  }

  @Post()
  createExpense(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateExpenseDto,
  ) {
    const businessId = req.user.businessId;
    return this.expensesService.createExpense(businessId, body);
  }
}
