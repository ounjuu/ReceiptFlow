import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || "";
  private readonly kakaoWebhookUrl = process.env.KAKAO_WEBHOOK_URL || "";

  // 슬랙 웹훅 전송
  async sendSlack(message: {
    title: string;
    text: string;
    color?: string; // hex color
    fields?: { title: string; value: string; short?: boolean }[];
  }) {
    if (!this.slackWebhookUrl) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(this.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          attachments: [
            {
              color: message.color || "#7c5cbf",
              title: message.title,
              text: message.text,
              fields: message.fields,
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
      clearTimeout(timeout);
    } catch (err) {
      this.logger.warn(`슬랙 알림 전송 실패: ${(err as Error).message}`);
    }
  }

  // 카카오 웹훅 전송 (범용 웹훅)
  async sendKakao(message: { text: string }) {
    if (!this.kakaoWebhookUrl) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(this.kakaoWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ text: message.text }),
      });
      clearTimeout(timeout);
    } catch (err) {
      this.logger.warn(`카카오 알림 전송 실패: ${(err as Error).message}`);
    }
  }

  // 결재 요청 알림
  async notifyApprovalRequest(data: {
    documentType: string;
    documentId: string;
    submitterName: string;
    approverName: string;
    description?: string;
  }) {
    const typeLabel = this.getDocTypeLabel(data.documentType);
    const title = `결재 요청: ${typeLabel}`;
    const text = `${data.submitterName}님이 결재를 요청했습니다.`;

    await this.sendSlack({
      title,
      text,
      color: "#2563eb",
      fields: [
        { title: "문서 유형", value: typeLabel, short: true },
        { title: "결재자", value: data.approverName, short: true },
        ...(data.description ? [{ title: "내용", value: data.description }] : []),
      ],
    });

    await this.sendKakao({ text: `[결재요청] ${typeLabel} - ${data.submitterName}님 → ${data.approverName}님` });
  }

  // 결재 승인 알림
  async notifyApprovalApproved(data: {
    documentType: string;
    documentId: string;
    approverName: string;
    submitterName: string;
    comment?: string;
  }) {
    const typeLabel = this.getDocTypeLabel(data.documentType);

    await this.sendSlack({
      title: `결재 승인: ${typeLabel}`,
      text: `${data.approverName}님이 승인했습니다.`,
      color: "#16a34a",
      fields: [
        { title: "요청자", value: data.submitterName, short: true },
        { title: "승인자", value: data.approverName, short: true },
        ...(data.comment ? [{ title: "코멘트", value: data.comment }] : []),
      ],
    });

    await this.sendKakao({ text: `[승인완료] ${typeLabel} - ${data.approverName}님 승인` });
  }

  // 결재 반려 알림
  async notifyApprovalRejected(data: {
    documentType: string;
    documentId: string;
    approverName: string;
    submitterName: string;
    comment?: string;
  }) {
    const typeLabel = this.getDocTypeLabel(data.documentType);

    await this.sendSlack({
      title: `결재 반려: ${typeLabel}`,
      text: `${data.approverName}님이 반려했습니다.`,
      color: "#dc2626",
      fields: [
        { title: "요청자", value: data.submitterName, short: true },
        { title: "반려자", value: data.approverName, short: true },
        ...(data.comment ? [{ title: "사유", value: data.comment }] : []),
      ],
    });

    await this.sendKakao({ text: `[반려] ${typeLabel} - ${data.approverName}님 반려${data.comment ? `: ${data.comment}` : ""}` });
  }

  private getDocTypeLabel(type: string): string {
    switch (type) {
      case "JOURNAL": return "전표";
      case "TAX_INVOICE": return "세금계산서";
      case "EXPENSE_CLAIM": return "경비청구";
      default: return type;
    }
  }
}
