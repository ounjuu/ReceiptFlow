import PDFDocument = require("pdfkit");
import { join } from "path";

export interface PdfContext {
  pageWidth: number;
  margin: number;
  contentWidth: number;
}

const FONT_REG_PATH = join(process.cwd(), "apps/api/assets/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD_PATH = join(process.cwd(), "apps/api/assets/fonts/NanumGothic-Bold.ttf");

/**
 * A4 PDF 문서를 생성하고 draw 콜백 안에서 본문을 그린 뒤 Buffer로 반환한다.
 * NanumGothic 폰트 등록과 chunks 수집/Promise 래핑을 공통 처리한다.
 */
export function generatePdfBuffer(
  draw: (doc: PDFKit.PDFDocument, ctx: PdfContext) => void,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.registerFont("NanumGothic", FONT_REG_PATH);
  doc.registerFont("NanumGothic-Bold", FONT_BOLD_PATH);

  const margin = 40;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - margin * 2;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      draw(doc, { pageWidth, margin, contentWidth });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
