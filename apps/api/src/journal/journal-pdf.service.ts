import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { join } from "path";
import {
  JOURNAL_TYPE_LABEL,
  STATUS_LABEL,
  EVIDENCE_TYPE_LABEL,
} from "./journal.constants";

@Injectable()
export class JournalPdfService {
  generatePdf(journal: any): Promise<Buffer> {
    const fontPath = join(process.cwd(), "apps/api/assets/fonts/NanumGothic-Regular.ttf");
    const fontBoldPath = join(process.cwd(), "apps/api/assets/fonts/NanumGothic-Bold.ttf");

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    doc.registerFont("NanumGothic", fontPath);
    doc.registerFont("NanumGothic-Bold", fontBoldPath);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // 제목
      doc.font("NanumGothic-Bold").fontSize(24).text("전    표", 0, 40, {
        align: "center",
        width: pageWidth,
      });

      let y = 85;

      // 헤더 정보 박스
      const headerHeight = 70;
      doc.rect(margin, y, contentWidth, headerHeight).stroke();

      const journalTypeLabel = JOURNAL_TYPE_LABEL[journal.journalType] || journal.journalType || "-";
      const statusText = STATUS_LABEL[journal.status] || journal.status || "-";
      const journalDate = journal.date
        ? new Date(journal.date).toLocaleDateString("ko-KR")
        : "-";

      // 1행: 전표번호, 전표유형
      doc.font("NanumGothic-Bold").fontSize(9);
      doc.text("전표번호:", margin + 10, y + 10);
      doc.font("NanumGothic").text(journal.journalNumber || "-", margin + 75, y + 10);

      doc.font("NanumGothic-Bold").text("전표유형:", margin + 280, y + 10);
      doc.font("NanumGothic").text(journalTypeLabel, margin + 345, y + 10);

      // 2행: 일자, 상태
      doc.font("NanumGothic-Bold").text("일    자:", margin + 10, y + 28);
      doc.font("NanumGothic").text(journalDate, margin + 75, y + 28);

      doc.font("NanumGothic-Bold").text("상    태:", margin + 280, y + 28);
      doc.font("NanumGothic").text(statusText, margin + 345, y + 28);

      // 3행: 적요
      doc.font("NanumGothic-Bold").text("적    요:", margin + 10, y + 46);
      doc.font("NanumGothic").text(journal.description || "-", margin + 75, y + 46, {
        width: contentWidth - 90,
      });

      y += headerHeight + 10;

      // 매입/매출 전표인 경우 부가세 정보
      const isTaxJournal =
        journal.journalType === "PURCHASE" || journal.journalType === "SALES";
      if (isTaxJournal) {
        const vatHeight = 45;
        doc.rect(margin, y, contentWidth, vatHeight).stroke();

        const evidenceLabel = journal.evidenceType
          ? EVIDENCE_TYPE_LABEL[journal.evidenceType] || journal.evidenceType
          : "-";
        const supplyAmount = Number(journal.supplyAmount || 0).toLocaleString("ko-KR");
        const vatAmount = Number(journal.vatAmount || 0).toLocaleString("ko-KR");
        const totalAmount = (
          Number(journal.supplyAmount || 0) + Number(journal.vatAmount || 0)
        ).toLocaleString("ko-KR");

        doc.font("NanumGothic-Bold").fontSize(9);
        doc.text("증빙유형:", margin + 10, y + 8);
        doc.font("NanumGothic").text(evidenceLabel, margin + 75, y + 8);

        doc.font("NanumGothic-Bold").text("공급가액:", margin + 10, y + 26);
        doc.font("NanumGothic").text(`${supplyAmount} 원`, margin + 75, y + 26);

        doc.font("NanumGothic-Bold").text("부 가 세:", margin + 200, y + 26);
        doc.font("NanumGothic").text(`${vatAmount} 원`, margin + 265, y + 26);

        doc.font("NanumGothic-Bold").text("합    계:", margin + 380, y + 26);
        doc.font("NanumGothic").text(`${totalAmount} 원`, margin + 445, y + 26);

        y += vatHeight + 10;
      }

      // 라인 테이블
      const cols = [
        { header: "계정코드", width: 70, align: "center" as const },
        { header: "계정과목", width: 130, align: "left" as const },
        { header: "거래처", width: 130, align: "left" as const },
        { header: "차변", width: (contentWidth - 330) / 2, align: "right" as const },
        { header: "대변", width: (contentWidth - 330) / 2, align: "right" as const },
      ];

      const rowHeight = 22;
      let x = margin;

      // 헤더 배경
      doc.rect(margin, y, contentWidth, rowHeight).fill("#e8e8e8").stroke();
      doc.fillColor("black");

      // 헤더 텍스트
      doc.font("NanumGothic-Bold").fontSize(9);
      x = margin;
      for (const col of cols) {
        doc.text(col.header, x + 3, y + 6, {
          width: col.width - 6,
          align: col.align,
        });
        x += col.width;
      }

      // 헤더 세로선
      x = margin;
      for (const col of cols) {
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
        x += col.width;
      }
      doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();

      // 헤더 가로선
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
      doc.moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).stroke();

      y += rowHeight;

      // 데이터 행
      const lines = journal.lines || [];
      doc.font("NanumGothic").fontSize(8);

      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of lines) {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        totalDebit += debit;
        totalCredit += credit;

        // 행 테두리
        doc.rect(margin, y, contentWidth, rowHeight).stroke();

        x = margin;
        const rowData = [
          line.account?.code || "-",
          line.account?.name || "-",
          line.vendor?.name || "-",
          debit > 0 ? debit.toLocaleString("ko-KR") : "",
          credit > 0 ? credit.toLocaleString("ko-KR") : "",
        ];

        for (let ci = 0; ci < cols.length; ci++) {
          doc.text(rowData[ci], x + 3, y + 6, {
            width: cols[ci].width - 6,
            align: cols[ci].align,
          });
          x += cols[ci].width;
        }

        // 세로선
        x = margin;
        for (const col of cols) {
          doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
          x += col.width;
        }
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();

        y += rowHeight;
      }

      // 합계 행
      doc.rect(margin, y, contentWidth, rowHeight).fill("#f5f5f5").stroke();
      doc.fillColor("black");
      doc.font("NanumGothic-Bold").fontSize(9);

      const sumLabelWidth = cols[0].width + cols[1].width + cols[2].width;
      doc.text("합    계", margin + 3, y + 6, {
        width: sumLabelWidth - 6,
        align: "center",
      });
      doc.text(totalDebit.toLocaleString("ko-KR"), margin + sumLabelWidth + 3, y + 6, {
        width: cols[3].width - 6,
        align: "right",
      });
      doc.text(
        totalCredit.toLocaleString("ko-KR"),
        margin + sumLabelWidth + cols[3].width + 3,
        y + 6,
        {
          width: cols[4].width - 6,
          align: "right",
        },
      );

      // 합계행 세로선
      x = margin;
      for (const col of cols) {
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
        x += col.width;
      }
      doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();

      y += rowHeight + 20;

      // 하단 서명란
      const signBoxHeight = 55;
      const signBoxWidth = contentWidth / 3;
      const signLabels = ["담 당", "검 토", "승 인"];
      for (let i = 0; i < 3; i++) {
        const sx = margin + signBoxWidth * i;
        doc.rect(sx, y, signBoxWidth, signBoxHeight).stroke();
        doc.font("NanumGothic-Bold").fontSize(9);
        doc.text(signLabels[i], sx + 5, y + 5, {
          width: signBoxWidth - 10,
          align: "center",
        });
      }

      doc.end();
    });
  }
}
