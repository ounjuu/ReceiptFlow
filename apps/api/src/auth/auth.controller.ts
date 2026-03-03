import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";

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

  // --- 멤버 관리 (ADMIN 전용) ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("members")
  async getMembers(@Query("tenantId") tenantId: string) {
    return this.authService.getMembers(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("invite")
  async invite(
    @Body() body: { email: string; role: string; tenantId: string },
  ) {
    return this.authService.invite(body.email, body.role, body.tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("members/:id")
  async updateMemberRole(
    @Param("id") id: string,
    @Body() body: { role: string },
  ) {
    return this.authService.updateMemberRole(id, body.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete("members/:id")
  async removeMember(@Param("id") id: string) {
    return this.authService.removeMember(id);
  }
}
