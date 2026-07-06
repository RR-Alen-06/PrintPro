import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { VendorsService } from './vendors.service';
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

@Controller('api/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  getVendors(@Request() req: AuthenticatedRequest) {
    return this.vendorsService.getVendors(req.user.businessId);
  }

  @Get(':id')
  getVendor(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vendorsService.getVendor(req.user.businessId, id);
  }

  @Post()
  @Roles('owner', 'manager')
  createVendor(@Request() req: AuthenticatedRequest, @Body() body: any) {
    return this.vendorsService.createVendor(req.user.businessId, body);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  updateVendor(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.vendorsService.updateVendor(req.user.businessId, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  deleteVendor(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vendorsService.deleteVendor(req.user.businessId, id);
  }

  @Post(':id/adjust-balance')
  @Roles('owner', 'manager')
  adjustBalance(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    return this.vendorsService.adjustBalance(req.user.businessId, id, body.amount);
  }
}
