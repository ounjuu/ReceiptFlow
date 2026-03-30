import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.fromAddress = process.env.SMTP_FROM || "LedgerFlow <noreply@ledgerflow.dev>";

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
      this.logger.log("SMTP 메일 전송 활성화");
    } else {
      this.logger.warn("SMTP 설정 없음 — 콘솔 로그 모드로 동작합니다");
    }
  }

  /** 메일 발송 (SMTP 미설정 시 콘솔 출력) */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[Mail 콘솔] To: ${to}\nSubject: ${subject}\nBody:\n${html.replace(/<[^>]*>/g, "")}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      html,
    });
    this.logger.log(`메일 발송 완료: ${to} — ${subject}`);
  }

  /** 결재 요청 알림 */
  sendApprovalRequest(
    to: string,
    approverName: string,
    documentType: string,
    documentDesc: string,
    submitterName: string,
  ): void {
    const typeLabel = this.documentTypeLabel(documentType);
    const subject = `[LedgerFlow] 결재 요청 — ${typeLabel}`;

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:#7c5cbf;padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">LedgerFlow</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#333;">
          <strong>${approverName}</strong>님, 결재 요청이 도착했습니다.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6fb;border-radius:8px;margin-bottom:24px;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 8px;font-size:14px;color:#666;">문서 유형</p>
            <p style="margin:0 0 16px;font-size:16px;color:#333;font-weight:600;">${typeLabel}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#666;">문서 내용</p>
            <p style="margin:0 0 16px;font-size:16px;color:#333;font-weight:600;">${documentDesc || "(내용 없음)"}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#666;">요청자</p>
            <p style="margin:0;font-size:16px;color:#333;font-weight:600;">${submitterName}</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;color:#999;">LedgerFlow에 로그인하여 결재를 처리해 주세요.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f4f4f7;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#aaa;">&copy; LedgerFlow. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    this.sendMail(to, subject, html).catch((err) =>
      this.logger.error(`결재 요청 메일 발송 실패: ${err.message}`),
    );
  }

  /** 결재 결과 알림 */
  sendApprovalResult(
    to: string,
    userName: string,
    documentType: string,
    documentDesc: string,
    action: "APPROVED" | "REJECTED",
    comment?: string,
  ): void {
    const typeLabel = this.documentTypeLabel(documentType);
    const isApproved = action === "APPROVED";
    const actionLabel = isApproved ? "승인" : "반려";
    const badgeColor = isApproved ? "#16a34a" : "#dc2626";
    const subject = `[LedgerFlow] 결재 ${actionLabel} — ${typeLabel}`;

    const commentSection = comment
      ? `<p style="margin:0 0 8px;font-size:14px;color:#666;">의견</p>
         <p style="margin:0;font-size:16px;color:#333;font-weight:600;">${comment}</p>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:#7c5cbf;padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">LedgerFlow</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#333;">
          <strong>${userName}</strong>님, 요청하신 결재가 처리되었습니다.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6fb;border-radius:8px;margin-bottom:24px;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 8px;font-size:14px;color:#666;">결재 결과</p>
            <p style="margin:0 0 16px;">
              <span style="display:inline-block;padding:4px 12px;border-radius:4px;background:${badgeColor};color:#fff;font-size:14px;font-weight:600;">${actionLabel}</span>
            </p>
            <p style="margin:0 0 8px;font-size:14px;color:#666;">문서 유형</p>
            <p style="margin:0 0 16px;font-size:16px;color:#333;font-weight:600;">${typeLabel}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#666;">문서 내용</p>
            <p style="margin:0 0 ${comment ? "16px" : "0"};font-size:16px;color:#333;font-weight:600;">${documentDesc || "(내용 없음)"}</p>
            ${commentSection}
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;color:#999;">LedgerFlow에서 상세 내용을 확인하세요.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f4f4f7;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#aaa;">&copy; LedgerFlow. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    this.sendMail(to, subject, html).catch((err) =>
      this.logger.error(`결재 결과 메일 발송 실패: ${err.message}`),
    );
  }

  private documentTypeLabel(type: string): string {
    const map: Record<string, string> = {
      JOURNAL: "전표",
      TAX_INVOICE: "세금계산서",
      EXPENSE_CLAIM: "경비 정산",
    };
    return map[type] || type;
  }
}
