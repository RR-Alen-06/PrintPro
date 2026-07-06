import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Settings } from '../schemas/settings.schema';
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

@Controller('api/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.settingsService.getSettings(businessId);
  }

  @Put()
  @Roles('owner', 'manager')
  updateSettings(
    @Request() req: AuthenticatedRequest,
    @Body() body: Partial<Settings>,
  ) {
    const businessId = req.user.businessId;
    return this.settingsService.updateSettings(businessId, body);
  }
}
