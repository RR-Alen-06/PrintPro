import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      email: string;
      password?: string;
      shopName: string;
      ownerName: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password?: string }) {
    return this.authService.loginUser(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  sync(@Request() req, @Body() body: { shopName?: string; ownerName?: string }) {
    // req.user has the payload from JwtStrategy
    return this.authService.syncUser(req.user, body.shopName, body.ownerName);
  }
}
