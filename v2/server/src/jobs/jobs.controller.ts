import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    businessId: string;
    role: string;
  };
}

@Controller('api/jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  getJobs(@Request() req: AuthenticatedRequest) {
    return this.jobsService.getJobs(req.user.businessId, req.user.role, req.user.email);
  }

  @Put(':id/status')
  updateJobStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.jobsService.updateJobStatus(
      req.user.businessId,
      id,
      body.status,
      req.user.role,
      req.user.email,
    );
  }

  @Delete(':id')
  deleteJob(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.deleteJob(req.user.businessId, id);
  }
}
