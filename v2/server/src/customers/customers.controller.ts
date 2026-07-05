import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Customer } from '../schemas/customer.schema';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  getCustomers(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.customersService.getCustomers(businessId);
  }

  @Get(':id')
  getCustomer(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.customersService.getCustomer(businessId, id);
  }

  @Post()
  createCustomer(
    @Request() req: AuthenticatedRequest,
    @Body() body: Partial<Customer>,
  ) {
    const businessId = req.user.businessId;
    return this.customersService.createCustomer(businessId, body);
  }

  @Put(':id')
  updateCustomer(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Partial<Customer>,
  ) {
    const businessId = req.user.businessId;
    return this.customersService.updateCustomer(businessId, id, body);
  }

  @Delete(':id')
  deleteCustomer(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const businessId = req.user.businessId;
    return this.customersService.deleteCustomer(businessId, id);
  }
}
