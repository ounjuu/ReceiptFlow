import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { SetApprovalLinesDto } from "./dto/set-approval-lines.dto";

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // 결재선 조회
  async getApprovalLines(tenantId: string, documentType?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (documentType) where.documentType = documentType;

    return this.prisma.approvalLine.findMany({
      where,
      include: { approver: { select: { id: true, name: true, email: true } } },
      orderBy: [{ documentType: "asc" }, { step: "asc" }],
    });
  }

  // 결재선 설정 (기존 삭제 후 재생성)
  async setApprovalLines(dto: SetApprovalLinesDto) {
    if (!["JOURNAL", "TAX_INVOICE", "EXPENSE_CLAIM"].includes(dto.documentType)) {
      throw new BadRequestException("문서 유형은 JOURNAL, TAX_INVOICE 또는 EXPENSE_CLAIM이어야 합니다");
    }

    return this.prisma.$transaction(async (tx) => {
      // 기존 결재선 삭제
      await tx.approvalLine.deleteMany({
        where: { tenantId: dto.tenantId, documentType: dto.documentType },
      });

      // 새 결재선 생성
      if (dto.lines.length > 0) {
        await tx.approvalLine.createMany({
          data: dto.lines.map((l) => ({
            tenantId: dto.tenantId,
            documentType: dto.documentType,
            step: l.step,
            approverId: l.approverId,
          })),
        });
      }

      return this.getApprovalLines(dto.tenantId, dto.documentType);
    });
  }

  // 결재 요청
  async submitForApproval(
    tenantId: string,
    documentType: string,
    documentId: string,
    submittedBy: string,
  ) {
    // 결재선 존재 확인
    const lines = await this.prisma.approvalLine.findMany({
      where: { tenantId, documentType },
      orderBy: { step: "asc" },
    });

    if (lines.length === 0) {
      throw new BadRequestException("결재선이 설정되지 않았습니다. 관리자에게 문의하세요.");
    }

    // 이미 진행 중인 결재 요청 확인
    const existing = await this.prisma.approvalRequest.findFirst({
      where: { documentType, documentId, status: "PENDING" },
    });
    if (existing) {
      throw new BadRequestException("이미 결재 요청 중인 문서입니다");
    }

    // 문서 상태를 PENDING_APPROVAL로 변경
    if (documentType === "JOURNAL") {
      const entry = await this.prisma.journalEntry.findUnique({ where: { id: documentId } });
      if (!entry) throw new NotFoundException("전표를 찾을 수 없습니다");
      if (entry.status !== "DRAFT") {
        throw new BadRequestException("임시 상태의 전표만 결재 요청할 수 있습니다");
      }
      await this.prisma.journalEntry.update({
        where: { id: documentId },
        data: { status: "PENDING_APPROVAL" },
      });
    } else if (documentType === "TAX_INVOICE") {
      const invoice = await this.prisma.taxInvoice.findUnique({ where: { id: documentId } });
      if (!invoice) throw new NotFoundException("세금계산서를 찾을 수 없습니다");
      if (invoice.status !== "DRAFT") {
        throw new BadRequestException("임시 상태의 세금계산서만 결재 요청할 수 있습니다");
      }
      await this.prisma.taxInvoice.update({
        where: { id: documentId },
        data: { status: "PENDING_APPROVAL" },
      });
    } else if (documentType === "EXPENSE_CLAIM") {
      const claim = await this.prisma.expenseClaim.findUnique({ where: { id: documentId } });
      if (!claim) throw new NotFoundException("경비 정산을 찾을 수 없습니다");
      if (claim.status !== "DRAFT") {
        throw new BadRequestException("임시저장 상태의 경비 정산만 결재 요청할 수 있습니다");
      }
      await this.prisma.expenseClaim.update({
        where: { id: documentId },
        data: { status: "PENDING_APPROVAL" },
      });
    }

    // 결재 요청 생성
    const approvalRequest = await this.prisma.approvalRequest.create({
      data: {
        tenantId,
        documentType,
        documentId,
        currentStep: 1,
        totalSteps: lines.length,
        status: "PENDING",
        submittedBy,
      },
      include: { actions: true },
    });

    // 첫 번째 결재자에게 이메일 알림 (fire-and-forget)
    try {
      const firstLine = lines[0];
      const approver = await this.prisma.user.findUnique({
        where: { id: firstLine.approverId },
        select: { email: true, name: true },
      });
      const submitter = await this.prisma.user.findUnique({
        where: { id: submittedBy },
        select: { name: true },
      });

      if (approver?.email) {
        const docDesc = await this.getDocumentDescription(documentType, documentId);
        this.mailService.sendApprovalRequest(
          approver.email,
          approver.name || "결재자",
          documentType,
          docDesc,
          submitter?.name || "요청자",
        );
      }
    } catch (err) {
      // 메일 발송 실패가 결재 흐름을 중단하지 않도록 무시
    }

    return approvalRequest;
  }

  // 승인/반려 처리
  async processApproval(
    requestId: string,
    approverId: string,
    action: string,
    comment?: string,
  ) {
    if (!["APPROVED", "REJECTED"].includes(action)) {
      throw new BadRequestException("action은 APPROVED 또는 REJECTED이어야 합니다");
    }

    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { actions: true },
    });

    if (!request) throw new NotFoundException("결재 요청을 찾을 수 없습니다");
    if (request.status !== "PENDING") {
      throw new BadRequestException("이미 처리된 결재 요청입니다");
    }

    // 현재 단계의 결재자인지 확인
    const currentLine = await this.prisma.approvalLine.findFirst({
      where: {
        tenantId: request.tenantId,
        documentType: request.documentType,
        step: request.currentStep,
      },
    });

    if (!currentLine || currentLine.approverId !== approverId) {
      throw new ForbiddenException("현재 단계의 결재자가 아닙니다");
    }

    // 결재 액션 기록
    await this.prisma.approvalAction.create({
      data: {
        approvalRequestId: requestId,
        step: request.currentStep,
        approverId,
        action,
        comment,
      },
    });

    if (action === "REJECTED") {
      // 반려: 문서 상태 → DRAFT, 요청 상태 → REJECTED
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      if (request.documentType === "JOURNAL") {
        await this.prisma.journalEntry.update({
          where: { id: request.documentId },
          data: { status: "DRAFT" },
        });
      } else if (request.documentType === "TAX_INVOICE") {
        await this.prisma.taxInvoice.update({
          where: { id: request.documentId },
          data: { status: "DRAFT" },
        });
      } else if (request.documentType === "EXPENSE_CLAIM") {
        await this.prisma.expenseClaim.update({
          where: { id: request.documentId },
          data: { status: "DRAFT" },
        });
      }

      // 반려 결과 메일 발송 (fire-and-forget)
      this.sendResultEmail(request.submittedBy, request.documentType, request.documentId, "REJECTED", comment);

      return { status: "REJECTED", message: "결재가 반려되었습니다" };
    }

    // 승인: 다음 단계로 이동 또는 최종 승인
    if (request.currentStep >= request.totalSteps) {
      // 최종 승인 완료
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      // 문서 상태 → APPROVED
      if (request.documentType === "JOURNAL") {
        await this.prisma.journalEntry.update({
          where: { id: request.documentId },
          data: { status: "APPROVED" },
        });
      } else if (request.documentType === "TAX_INVOICE") {
        await this.prisma.taxInvoice.update({
          where: { id: request.documentId },
          data: { status: "APPROVED" },
        });
      } else if (request.documentType === "EXPENSE_CLAIM") {
        await this.prisma.expenseClaim.update({
          where: { id: request.documentId },
          data: { status: "APPROVED" },
        });
      }

      // 최종 승인 결과 메일 발송 (fire-and-forget)
      this.sendResultEmail(request.submittedBy, request.documentType, request.documentId, "APPROVED", comment);

      return { status: "APPROVED", message: "최종 승인되었습니다" };
    } else {
      // 다음 단계로
      const nextStep = request.currentStep + 1;
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { currentStep: nextStep },
      });

      // 다음 결재자에게 알림 메일 (fire-and-forget)
      try {
        const nextLine = await this.prisma.approvalLine.findFirst({
          where: {
            tenantId: request.tenantId,
            documentType: request.documentType,
            step: nextStep,
          },
        });
        if (nextLine) {
          const nextApprover = await this.prisma.user.findUnique({
            where: { id: nextLine.approverId },
            select: { email: true, name: true },
          });
          const submitter = await this.prisma.user.findUnique({
            where: { id: request.submittedBy },
            select: { name: true },
          });
          if (nextApprover?.email) {
            const docDesc = await this.getDocumentDescription(request.documentType, request.documentId);
            this.mailService.sendApprovalRequest(
              nextApprover.email,
              nextApprover.name || "결재자",
              request.documentType,
              docDesc,
              submitter?.name || "요청자",
            );
          }
        }
      } catch (err) {
        // 메일 발송 실패가 결재 흐름을 중단하지 않도록 무시
      }

      return {
        status: "PENDING",
        message: `${request.currentStep}단계 승인 완료. ${nextStep}단계 결재 대기 중`,
      };
    }
  }

  // 내 결재 대기 건 조회
  async getMyPendingApprovals(tenantId: string, userId: string) {
    // 내가 결재자인 결재선 조회
    const myLines = await this.prisma.approvalLine.findMany({
      where: { tenantId, approverId: userId },
    });

    if (myLines.length === 0) return [];

    // 각 결재선에 해당하는 PENDING 요청 조회
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        tenantId,
        status: "PENDING",
        OR: myLines.map((l) => ({
          documentType: l.documentType,
          currentStep: l.step,
        })),
      },
      include: {
        actions: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 각 요청에 문서 정보 추가
    const results = await Promise.all(
      requests.map(async (r) => {
        let documentInfo: { description: string; date: string } = {
          description: "",
          date: "",
        };

        if (r.documentType === "JOURNAL") {
          const entry = await this.prisma.journalEntry.findUnique({
            where: { id: r.documentId },
            select: { description: true, date: true },
          });
          if (entry) {
            documentInfo = {
              description: entry.description || "",
              date: entry.date.toISOString(),
            };
          }
        } else if (r.documentType === "TAX_INVOICE") {
          const invoice = await this.prisma.taxInvoice.findUnique({
            where: { id: r.documentId },
            select: { description: true, invoiceDate: true, issuerName: true, recipientName: true },
          });
          if (invoice) {
            documentInfo = {
              description: invoice.description || `${invoice.issuerName} → ${invoice.recipientName}`,
              date: invoice.invoiceDate.toISOString(),
            };
          }
        } else if (r.documentType === "EXPENSE_CLAIM") {
          const claim = await this.prisma.expenseClaim.findUnique({
            where: { id: r.documentId },
            select: { title: true, claimDate: true, claimNo: true, totalAmount: true },
          });
          if (claim) {
            documentInfo = {
              description: `${claim.title} (${claim.claimNo}) - ${Number(claim.totalAmount).toLocaleString()}원`,
              date: claim.claimDate.toISOString(),
            };
          }
        }

        // 요청자 정보
        const submitter = await this.prisma.user.findUnique({
          where: { id: r.submittedBy },
          select: { name: true },
        });

        return {
          ...r,
          documentInfo,
          submitterName: submitter?.name || "",
        };
      }),
    );

    return results;
  }

  // 결재 이력 조회 (특정 문서)
  async getApprovalHistory(tenantId: string, documentType: string, documentId: string) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { tenantId, documentType, documentId },
      include: {
        actions: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { step: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 각 요청의 결재선 정보 추가
    const results = await Promise.all(
      requests.map(async (r) => {
        const lines = await this.prisma.approvalLine.findMany({
          where: { tenantId, documentType },
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { step: "asc" },
        });

        const submitter = await this.prisma.user.findUnique({
          where: { id: r.submittedBy },
          select: { name: true },
        });

        return {
          ...r,
          submitterName: submitter?.name || "",
          approvalLines: lines,
        };
      }),
    );

    return results;
  }

  /** 결재 결과 메일 발송 헬퍼 (fire-and-forget) */
  private sendResultEmail(
    submittedBy: string,
    documentType: string,
    documentId: string,
    action: "APPROVED" | "REJECTED",
    comment?: string,
  ): void {
    (async () => {
      const submitter = await this.prisma.user.findUnique({
        where: { id: submittedBy },
        select: { email: true, name: true },
      });
      if (!submitter?.email) return;

      const docDesc = await this.getDocumentDescription(documentType, documentId);
      this.mailService.sendApprovalResult(
        submitter.email,
        submitter.name || "사용자",
        documentType,
        docDesc,
        action,
        comment,
      );
    })().catch(() => {});
  }

  /** 문서 설명 조회 헬퍼 */
  private async getDocumentDescription(documentType: string, documentId: string): Promise<string> {
    if (documentType === "JOURNAL") {
      const entry = await this.prisma.journalEntry.findUnique({
        where: { id: documentId },
        select: { description: true },
      });
      return entry?.description || "";
    } else if (documentType === "TAX_INVOICE") {
      const invoice = await this.prisma.taxInvoice.findUnique({
        where: { id: documentId },
        select: { description: true, issuerName: true, recipientName: true },
      });
      return invoice?.description || `${invoice?.issuerName} → ${invoice?.recipientName}` || "";
    } else if (documentType === "EXPENSE_CLAIM") {
      const claim = await this.prisma.expenseClaim.findUnique({
        where: { id: documentId },
        select: { title: true, claimNo: true, totalAmount: true },
      });
      return claim ? `${claim.title} (${claim.claimNo}) - ${Number(claim.totalAmount).toLocaleString()}원` : "";
    }
    return "";
  }

  // 내 결재 요청 현황 (내가 올린 결재)
  async getMySubmissions(tenantId: string, userId: string) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { tenantId, submittedBy: userId },
      include: {
        actions: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { step: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const results = await Promise.all(
      requests.map(async (r) => {
        let documentInfo: { description: string; date: string } = {
          description: "",
          date: "",
        };

        if (r.documentType === "JOURNAL") {
          const entry = await this.prisma.journalEntry.findUnique({
            where: { id: r.documentId },
            select: { description: true, date: true },
          });
          if (entry) {
            documentInfo = {
              description: entry.description || "",
              date: entry.date.toISOString(),
            };
          }
        } else if (r.documentType === "TAX_INVOICE") {
          const invoice = await this.prisma.taxInvoice.findUnique({
            where: { id: r.documentId },
            select: { description: true, invoiceDate: true, issuerName: true, recipientName: true },
          });
          if (invoice) {
            documentInfo = {
              description: invoice.description || `${invoice.issuerName} → ${invoice.recipientName}`,
              date: invoice.invoiceDate.toISOString(),
            };
          }
        } else if (r.documentType === "EXPENSE_CLAIM") {
          const claim = await this.prisma.expenseClaim.findUnique({
            where: { id: r.documentId },
            select: { title: true, claimDate: true, claimNo: true, totalAmount: true },
          });
          if (claim) {
            documentInfo = {
              description: `${claim.title} (${claim.claimNo}) - ${Number(claim.totalAmount).toLocaleString()}원`,
              date: claim.claimDate.toISOString(),
            };
          }
        }

        return { ...r, documentInfo };
      }),
    );

    return results;
  }
}
