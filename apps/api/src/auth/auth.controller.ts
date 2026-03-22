import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { CurrentTenant } from "./current-tenant.decorator";

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

  // --- 프로필 / 비밀번호 ---

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  async updateProfile(
    @Request() req: { user: { userId: string } },
    @Body() body: { name: string },
  ) {
    return this.authService.updateProfile(req.user.userId, body.name);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/password")
  async changePassword(
    @Request() req: { user: { userId: string } },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  // --- 멤버 관리 (ADMIN 전용) ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("members")
  async getMembers(@CurrentTenant() tenantId: string) {
    return this.authService.getMembers(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("invite")
  async invite(
    @CurrentTenant() tenantId: string,
    @Body() body: { email: string; role: string },
  ) {
    return this.authService.invite(body.email, body.role, tenantId);
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
