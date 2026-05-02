import { Injectable } from "@nestjs/common";
import { generatePdfBuffer } from "../common/pdf-generator";

@Injectable()
export class TaxInvoicePdfService {
  generatePdf(invoice: any): Promise<Buffer> {
    return generatePdfBuffer((doc, { pageWidth, margin, contentWidth }) => {
      // 제목
      doc.font("NanumGothic-Bold").fontSize(20).text("세 금 계 산 서 (공급자 보관용)", 0, 40, {
        align: "center",
        width: pageWidth,
      });

      let y = 75;

      // 승인번호
      if (invoice.approvalNo) {
        doc.font("NanumGothic").fontSize(8).text(`승인번호: ${invoice.approvalNo}`, margin, y, {
          align: "right",
          width: contentWidth,
        });
      }

      y = 95;

      // 공급자 / 공급받는자 정보 박스
      const halfWidth = contentWidth / 2 - 5;
      const infoBoxHeight = 70;

      // 공급자 (좌측)
      doc.rect(margin, y, halfWidth, infoBoxHeight).stroke();
      doc.font("NanumGothic-Bold").fontSize(10).text("공 급 자", margin + 5, y + 5);
      doc.font("NanumGothic").fontSize(9);
      doc.text(`등록번호: ${invoice.issuerBizNo || "-"}`, margin + 5, y + 22);
      doc.text(`상    호: ${invoice.issuerName || "-"}`, margin + 5, y + 38);

      // 공급받는자 (우측)
      const rightX = margin + halfWidth + 10;
      doc.rect(rightX, y, halfWidth, infoBoxHeight).stroke();
      doc.font("NanumGothic-Bold").fontSize(10).text("공 급 받 는 자", rightX + 5, y + 5);
      doc.font("NanumGothic").fontSize(9);
      doc.text(`등록번호: ${invoice.recipientBizNo || "-"}`, rightX + 5, y + 22);
      doc.text(`상    호: ${invoice.recipientName || "-"}`, rightX + 5, y + 38);

      y += infoBoxHeight + 15;

      // 작성일자
      const invoiceDate = invoice.invoiceDate
        ? new Date(invoice.invoiceDate).toLocaleDateString("ko-KR")
        : "-";
      doc.font("NanumGothic").fontSize(9).text(`작성일자: ${invoiceDate}`, margin, y);

      y += 20;

      // 품목 테이블
      const cols = [
        { header: "월일", width: 50, align: "center" as const },
        { header: "품목", width: 120, align: "left" as const },
        { header: "규격", width: 65, align: "left" as const },
        { header: "수량", width: 45, align: "right" as const },
        { header: "단가", width: 70, align: "right" as const },
        { header: "공급가액", width: 75, align: "right" as const },
        { header: "세액", width: 65, align: "right" as const },
        { header: "비고", width: contentWidth - 490, align: "left" as const },
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
        doc.text(col.header, x + 2, y + 6, {
          width: col.width - 4,
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

      // 데이터 행 (최소 4행 보장)
      const items = invoice.items || [];
      const minRows = Math.max(items.length, 4);
      doc.font("NanumGothic").fontSize(8);

      for (let idx = 0; idx < minRows; idx++) {
        const item = items[idx];

        // 행 테두리
        doc.rect(margin, y, contentWidth, rowHeight).stroke();

        if (item) {
          const itemDate = item.itemDate
            ? new Date(item.itemDate).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
            : "";

          x = margin;
          const rowData = [
            itemDate,
            item.itemName || "-",
            item.specification || "-",
            item.quantity != null ? Number(item.quantity).toLocaleString("ko-KR") : "",
            item.unitPrice != null ? Number(item.unitPrice).toLocaleString("ko-KR") : "",
            item.supplyAmount != null ? Number(item.supplyAmount).toLocaleString("ko-KR") : "",
            item.taxAmount != null ? Number(item.taxAmount).toLocaleString("ko-KR") : "",
            item.remark || "",
          ];

          for (let ci = 0; ci < cols.length; ci++) {
            doc.text(rowData[ci], x + 2, y + 6, {
              width: cols[ci].width - 4,
              align: cols[ci].align,
            });
            x += cols[ci].width;
          }
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
      const supplyAmount = Number(invoice.supplyAmount || 0).toLocaleString("ko-KR");
      const taxAmount = Number(invoice.taxAmount || 0).toLocaleString("ko-KR");
      const totalAmount = Number(invoice.totalAmount || 0).toLocaleString("ko-KR");

      doc.rect(margin, y, contentWidth, 65).stroke();

      doc.font("NanumGothic-Bold").fontSize(9);
      doc.text("공급가액 합계:", margin + 10, y + 8);
      doc.font("NanumGothic").text(`${supplyAmount} 원`, margin + 100, y + 8);

      doc.font("NanumGothic-Bold").text("세  액  합계:", margin + 10, y + 26);
      doc.font("NanumGothic").text(`${taxAmount} 원`, margin + 100, y + 26);

      doc.moveTo(margin, y + 42).lineTo(margin + contentWidth, y + 42).stroke();
      doc.font("NanumGothic-Bold").fontSize(11).text("합계금액:", margin + 10, y + 47);
      doc.font("NanumGothic-Bold").text(`${totalAmount} 원`, margin + 100, y + 47);

      y += 75;

      // 영수/청구
      const typeLabel = invoice.invoiceType === "SALES" ? "청  구" : "영  수";
      doc.font("NanumGothic-Bold").fontSize(12).text(`이 금액을 ${typeLabel} 함`, 0, y, {
        align: "center",
        width: pageWidth,
      });

    });
  }
}
