import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApprovalService } from "./approval.service";
import { SetApprovalLinesDto } from "./dto/set-approval-lines.dto";
import { SubmitApprovalDto } from "./dto/submit-approval.dto";
import { ProcessApprovalDto } from "./dto/process-approval.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("approvals")
export class ApprovalController {
  constructor(private readonly service: ApprovalService) {}

  // 결재선 조회
  @Get("lines")
  async getLines(
    @Query("tenantId") tenantId: string,
    @Query("documentType") documentType?: string,
  ) {
    return this.service.getApprovalLines(tenantId, documentType);
  }

  // 결재선 설정
  @Put("lines")
  @Roles("ADMIN")
  async setLines(@Body() dto: SetApprovalLinesDto) {
    return this.service.setApprovalLines(dto);
  }

  // 결재 요청
  @Post("submit")
  @Roles("ADMIN", "ACCOUNTANT")
  async submit(
    @Body() dto: SubmitApprovalDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.service.submitForApproval(
      dto.tenantId,
      dto.documentType,
      dto.documentId,
      req.user.userId,
    );
  }

  // 내 결재 대기 건
  @Get("pending")
  async getPending(
    @Query("tenantId") tenantId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.service.getMyPendingApprovals(tenantId, req.user.userId);
  }

  // 내 결재 요청 현황
  @Get("submissions")
  async getSubmissions(
    @Query("tenantId") tenantId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.service.getMySubmissions(tenantId, req.user.userId);
  }

  // 결재 이력 (특정 문서)
  @Get("history")
  async getHistory(
    @Query("tenantId") tenantId: string,
    @Query("documentType") documentType: string,
    @Query("documentId") documentId: string,
  ) {
    return this.service.getApprovalHistory(tenantId, documentType, documentId);
  }

  // 승인/반려 처리
  @Post(":id/process")
  async process(
    @Param("id") id: string,
    @Body() dto: ProcessApprovalDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.service.processApproval(
      id,
      req.user.userId,
      dto.action,
      dto.comment,
    );
  }
}
