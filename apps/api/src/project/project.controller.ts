import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects")
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  // 정적 경로 먼저
  @Get("pnl/comparison")
  async getComparison(@Query("tenantId") tenantId: string) {
    return this.service.getProjectComparison(tenantId);
  }

  @Get()
  async list(@Query("tenantId") tenantId: string) {
    return this.service.getProjects(tenantId);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.service.getProject(id);
  }

  @Get(":id/pnl")
  async getPnL(
    @Param("id") id: string,
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getProjectPnL(tenantId, id, startDate, endDate);
  }

  @Post()
  @Roles("ADMIN", "ACCOUNTANT")
  async create(@Body() dto: CreateProjectDto) {
    return this.service.createProject(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "ACCOUNTANT")
  async update(@Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.service.updateProject(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.service.deleteProject(id);
  }
}
