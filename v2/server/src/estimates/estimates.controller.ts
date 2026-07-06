import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/estimates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get()
  getEstimates(@Request() req: AuthenticatedRequest) {
    return this.estimatesService.getEstimates(req.user.businessId);
  }

  @Get(':id')
  getEstimate(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.estimatesService.getEstimate(req.user.businessId, id);
  }

  @Post()
  createEstimate(@Request() req: AuthenticatedRequest, @Body() body: any) {
    return this.estimatesService.createEstimate(req.user.businessId, body);
  }

  @Put(':id')
  updateEstimate(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.estimatesService.updateEstimate(req.user.businessId, id, body);
  }

  @Delete(':id')
  deleteEstimate(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.estimatesService.deleteEstimate(req.user.businessId, id);
  }

  @Post(':id/convert')
  convertToInvoice(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { amountPaid: number; cashPaid: number; upiPaid: number; advanceUsed: number },
  ) {
    return this.estimatesService.convertToInvoice(req.user.businessId, id, body);
  }
}
