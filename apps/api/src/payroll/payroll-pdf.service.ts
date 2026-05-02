import { Injectable } from "@nestjs/common";
import { generatePdfBuffer } from "../common/pdf-generator";

@Injectable()
export class PayrollPdfService {
  generatePayslipPdf(record: {
    employeeNo: string;
    employeeName: string;
    department: string | null;
    position: string | null;
    period: string;
    baseSalary: number;
    overtimePay: number;
    bonusPay: number;
    grossPay: number;
    nationalPension: number;
    healthInsurance: number;
    longTermCare: number;
    employmentInsurance: number;
    incomeTax: number;
    localIncomeTax: number;
    totalDeduction: number;
    netPay: number;
  }): Promise<Buffer> {
    return generatePdfBuffer((doc, { pageWidth, margin, contentWidth }) => {
      const fmt = (n: number) => n.toLocaleString("ko-KR");

      // 기간 파싱
      const [yearStr, monthStr] = record.period.split("-");
      const periodLabel = `${yearStr}년 ${parseInt(monthStr, 10)}월`;

      // ── 제목 ──
      doc.font("NanumGothic-Bold").fontSize(22).text("급 여 명 세 서", 0, 40, {
        align: "center",
        width: pageWidth,
      });

      let y = 80;

      // ── 기간 ──
      doc.font("NanumGothic").fontSize(11).text(`귀속 기간: ${periodLabel}`, margin, y);
      y += 30;

      // ── 직원 정보 박스 ──
      const infoBoxHeight = 70;
      doc.rect(margin, y, contentWidth, infoBoxHeight).stroke();

      doc.font("NanumGothic-Bold").fontSize(10).text("직원 정보", margin + 10, y + 8);

      const infoY = y + 26;
      const col2X = margin + contentWidth / 2;

      doc.font("NanumGothic").fontSize(9);
      doc.text(`사    번: ${record.employeeNo}`, margin + 10, infoY);
      doc.text(`성    명: ${record.employeeName}`, col2X, infoY);
      doc.text(`부    서: ${record.department || "-"}`, margin + 10, infoY + 18);
      doc.text(`직    위: ${record.position || "-"}`, col2X, infoY + 18);

      y += infoBoxHeight + 20;

      // ── 테이블 그리기 헬퍼 ──
      const rowHeight = 24;
      const labelWidth = contentWidth / 2;
      const valueWidth = contentWidth / 2;

      const drawTableHeader = (title: string, startY: number) => {
        doc.rect(margin, startY, contentWidth, rowHeight).fill("#e8e8e8").stroke();
        doc.fillColor("black");
        doc.font("NanumGothic-Bold").fontSize(9);
        doc.text(title, margin + 8, startY + 7, { width: labelWidth });
        doc.text("금액 (원)", margin + labelWidth + 8, startY + 7, {
          width: valueWidth - 16,
          align: "right",
        });
        // 세로선
        doc.moveTo(margin + labelWidth, startY).lineTo(margin + labelWidth, startY + rowHeight).stroke();
        return startY + rowHeight;
      };

      const drawRow = (label: string, value: number, startY: number, bold = false) => {
        doc.rect(margin, startY, contentWidth, rowHeight).stroke();
        const fontName = bold ? "NanumGothic-Bold" : "NanumGothic";
        doc.font(fontName).fontSize(9);
        doc.text(label, margin + 8, startY + 7, { width: labelWidth - 16 });
        doc.text(`${fmt(value)}`, margin + labelWidth + 8, startY + 7, {
          width: valueWidth - 16,
          align: "right",
        });
        // 세로선
        doc.moveTo(margin + labelWidth, startY).lineTo(margin + labelWidth, startY + rowHeight).stroke();
        return startY + rowHeight;
      };

      // ── 지급 내역 ──
      y = drawTableHeader("지급 항목", y);
      y = drawRow("기본급", record.baseSalary, y);
      y = drawRow("시간외수당", record.overtimePay, y);
      y = drawRow("상여금", record.bonusPay, y);
      y = drawRow("총지급액", record.grossPay, y, true);

      y += 15;

      // ── 공제 내역 ──
      y = drawTableHeader("공제 항목", y);
      y = drawRow("국민연금", record.nationalPension, y);
      y = drawRow("건강보험", record.healthInsurance, y);
      y = drawRow("장기요양보험", record.longTermCare, y);
      y = drawRow("고용보험", record.employmentInsurance, y);
      y = drawRow("소득세", record.incomeTax, y);
      y = drawRow("지방소득세", record.localIncomeTax, y);
      y = drawRow("총공제액", record.totalDeduction, y, true);

      y += 25;

      // ── 실수령액 ──
      doc.rect(margin, y, contentWidth, 40).fill("#f0f7ff").stroke();
      doc.fillColor("black");
      doc.font("NanumGothic-Bold").fontSize(14);
      doc.text("실수령액", margin + 10, y + 12, { width: labelWidth - 20 });
      doc.text(`${fmt(record.netPay)} 원`, margin + labelWidth + 10, y + 12, {
        width: valueWidth - 20,
        align: "right",
      });

      y += 60;

      // ── 발급 정보 ──
      const today = new Date();
      const issueDateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

      doc.font("NanumGothic").fontSize(9);
      doc.text(`발급일: ${issueDateStr}`, margin, y);
      y += 18;
      doc.text("위 금액을 정히 지급합니다.", margin, y);
      y += 30;
      doc.font("NanumGothic-Bold").fontSize(11).text("(주) LedgerFlow", 0, y, {
        align: "center",
        width: pageWidth,
      });

    });
  }
}
