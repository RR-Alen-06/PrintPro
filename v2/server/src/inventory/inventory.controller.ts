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
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Inventory } from '../schemas/inventory.schema';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getItems(@Request() req: AuthenticatedRequest) {
    const businessId = req.user.businessId;
    return this.inventoryService.getItems(businessId);
  }

  @Post()
  createItem(
    @Request() req: AuthenticatedRequest,
    @Body() body: Partial<Inventory>,
  ) {
    const businessId = req.user.businessId;
    return this.inventoryService.createItem(businessId, body);
  }

  @Put(':id')
  updateItem(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Partial<Inventory>,
  ) {
    const businessId = req.user.businessId;
    return this.inventoryService.updateItem(businessId, id, body);
  }

  @Delete(':id')
  deleteItem(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.inventoryService.deleteItem(businessId, id);
  }
}
