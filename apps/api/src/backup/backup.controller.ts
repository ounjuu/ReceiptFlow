import {
  Controller, Get, Post, Body, Res, UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { BackupService } from "./backup.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("backup")
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // 데이터 백업 (JSON 다운로드)
  @Get("export")
  @Roles("ADMIN")
  async exportData(@CurrentTenant() tenantId: string, @Res() res: Response) {
    const backup = await this.backupService.exportData(tenantId);
    const filename = `ledgerflow-backup-${new Date().toISOString().slice(0, 10)}.json`;

    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(JSON.stringify(backup, null, 2));
  }

  // 데이터 복원 (JSON 업로드)
  @Post("import")
  @Roles("ADMIN")
  async importData(
    @CurrentTenant() tenantId: string,
    @Body() body: { version: string; data: Record<string, unknown[]> },
  ) {
    return this.backupService.importData(tenantId, body);
  }
}
