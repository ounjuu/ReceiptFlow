import { Injectable } from "@nestjs/common";
import { generatePdfBuffer } from "../common/pdf-generator";

@Injectable()
export class TradePdfService {
  generatePdf(trade: any): Promise<Buffer> {
    return generatePdfBuffer((doc, { pageWidth, margin, contentWidth }) => {
      // 제목
      doc.font("NanumGothic-Bold").fontSize(22).text("거 래 명 세 서", 0, 40, {
        align: "center",
        width: pageWidth,
      });

      let y = 80;

      // 공급받는자 / 공급자 정보 박스
      const boxWidth = contentWidth / 2 - 5;
      const boxHeight = 60;

      // 공급받는자 (좌측)
      doc.rect(margin, y, boxWidth, boxHeight).stroke();
      doc.font("NanumGothic-Bold").fontSize(10).text("공급받는자", margin + 5, y + 5);
      doc.font("NanumGothic").fontSize(9);
      doc.text(`상  호: ${trade.vendor?.name || "-"}`, margin + 5, y + 22);
      doc.text(`사업자등록번호: ${trade.vendor?.bizNo || "-"}`, margin + 5, y + 38);

      // 공급자 (우측) - 회사 정보 (기본값 사용)
      const rightX = margin + boxWidth + 10;
      doc.rect(rightX, y, boxWidth, boxHeight).stroke();
      doc.font("NanumGothic-Bold").fontSize(10).text("공급자", rightX + 5, y + 5);
      doc.font("NanumGothic").fontSize(9);
      doc.text("상  호: (자사)", rightX + 5, y + 22);
      doc.text("사업자등록번호: -", rightX + 5, y + 38);

      y += boxHeight + 15;

      // 거래 정보
      doc.font("NanumGothic-Bold").fontSize(10);
      const tradeTypeLabel = trade.tradeType === "SALES" ? "매출" : "매입";
      const tradeDate = trade.tradeDate
        ? new Date(trade.tradeDate).toLocaleDateString("ko-KR")
        : "-";

      doc.font("NanumGothic").fontSize(9);
      doc.text(`거래번호: ${trade.tradeNo || "-"}`, margin, y);
      doc.text(`거래일: ${tradeDate}`, margin + 200, y);
      doc.text(`거래유형: ${tradeTypeLabel}`, margin + 380, y);

      y += 25;

      // 품목 테이블
      const cols = [
        { header: "No", width: 35, align: "center" as const },
        { header: "품명", width: 140, align: "left" as const },
        { header: "규격", width: 80, align: "left" as const },
        { header: "수량", width: 55, align: "right" as const },
        { header: "단가", width: 75, align: "right" as const },
        { header: "금액", width: 80, align: "right" as const },
        { header: "비고", width: contentWidth - 465, align: "left" as const },
      ];

      const rowHeight = 22;
      let x = margin;

      // 헤더 배경
      doc.rect(margin, y, contentWidth, rowHeight).fill("#e8e8e8").stroke();
      doc.fillColor("black");

      // 헤더 텍스트
      doc.font("NanumGothic-Bold").fontSize(8);
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
      const items = trade.items || [];
      doc.font("NanumGothic").fontSize(8);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];

        // 행 테두리
        doc.rect(margin, y, contentWidth, rowHeight).stroke();

        x = margin;
        const rowData = [
          String(idx + 1),
          item.itemName || "-",
          item.specification || "-",
          Number(item.quantity || 0).toLocaleString("ko-KR"),
          Number(item.unitPrice || 0).toLocaleString("ko-KR"),
          Number(item.amount || 0).toLocaleString("ko-KR"),
          item.note || "",
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

      y += 10;

      // 합계
      doc.font("NanumGothic-Bold").fontSize(10);
      const supplyAmount = Number(trade.supplyAmount || 0).toLocaleString("ko-KR");
      const taxAmount = Number(trade.taxAmount || 0).toLocaleString("ko-KR");
      const totalAmount = Number(trade.totalAmount || 0).toLocaleString("ko-KR");

      doc.rect(margin, y, contentWidth, 65).stroke();

      doc.font("NanumGothic-Bold").fontSize(9);
      doc.text("공급가액:", margin + 10, y + 8);
      doc.font("NanumGothic").text(`${supplyAmount} 원`, margin + 80, y + 8);

      doc.font("NanumGothic-Bold").text("세    액:", margin + 10, y + 26);
      doc.font("NanumGothic").text(`${taxAmount} 원`, margin + 80, y + 26);

      doc.moveTo(margin, y + 42).lineTo(margin + contentWidth, y + 42).stroke();
      doc.font("NanumGothic-Bold").fontSize(11).text("합계금액:", margin + 10, y + 47);
      doc.font("NanumGothic-Bold").text(`${totalAmount} 원`, margin + 80, y + 47);

      y += 75;

      // 비고
      if (trade.description || trade.note) {
        doc.font("NanumGothic-Bold").fontSize(9).text("비고", margin, y);
        y += 15;
        doc.font("NanumGothic").fontSize(9);
        if (trade.description) {
          doc.text(trade.description, margin + 5, y, { width: contentWidth - 10 });
          y += 15;
        }
        if (trade.note) {
          doc.text(trade.note, margin + 5, y, { width: contentWidth - 10 });
        }
      }

    });
  }
}
