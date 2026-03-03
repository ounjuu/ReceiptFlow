import { Controller, Post, Get, Body, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("signup")
  async signup(
    @Body() body: { email: string; password: string; name: string },
  ) {
    return this.authService.signup(body.email, body.password, body.name);
  }

  @Post("login")
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Request() req: { user: { userId: string } }) {
    return this.authService.getMe(req.user.userId);
  }
}
