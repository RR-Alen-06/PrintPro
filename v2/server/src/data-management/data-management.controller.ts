import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { DataManagementService } from './data-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/data-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager')
export class DataManagementController {
  constructor(private readonly dataManagementService: DataManagementService) {}

  @Get('export')
  exportData(@Request() req) {
    return this.dataManagementService.exportData(req.user.businessId);
  }

  @Post('import')
  importData(@Request() req, @Body() payload: any) {
    return this.dataManagementService.importData(req.user.businessId, payload);
  }
}
