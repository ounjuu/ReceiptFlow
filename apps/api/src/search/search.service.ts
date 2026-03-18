import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

export interface SearchGroup {
  entity: string;
  label: string;
  items: SearchResultItem[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, q: string, limit = 5) {
    const take = Math.min(limit, 20);

    const [
      accounts,
      vendors,
      journals,
      taxInvoices,
      projects,
      departments,
      products,
      trades,
      expenseClaims,
      fixedAssets,
    ] = await Promise.all([
      // 계정과목
      this.prisma.account.findMany({
        where: {
          tenantId,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
      }),
      // 거래처
      this.prisma.vendor.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { bizNo: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
      }),
      // 전표
      this.prisma.journalEntry.findMany({
        where: {
          tenantId,
          description: { contains: q, mode: "insensitive" },
        },
        take,
        orderBy: { date: "desc" },
      }),
      // 세금계산서
      this.prisma.taxInvoice.findMany({
        where: {
          tenantId,
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { issuerName: { contains: q, mode: "insensitive" } },
            { recipientName: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
        orderBy: { invoiceDate: "desc" },
      }),
      // 프로젝트
      this.prisma.project.findMany({
        where: {
          tenantId,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
      }),
      // 부서
      this.prisma.department.findMany({
        where: {
          tenantId,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
      }),
      // 품목
      this.prisma.product.findMany({
        where: {
          tenantId,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
      }),
      // 매출/매입
      this.prisma.trade.findMany({
        where: {
          tenantId,
          OR: [
            { tradeNo: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
        orderBy: { tradeDate: "desc" },
      }),
      // 경비 정산
      this.prisma.expenseClaim.findMany({
        where: {
          tenantId,
          OR: [
            { claimNo: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
          ],
        },
        take,
        orderBy: { claimDate: "desc" },
      }),
      // 고정자산
      this.prisma.fixedAsset.findMany({
        where: {
          tenantId,
          name: { contains: q, mode: "insensitive" },
        },
        take,
      }),
    ]);

    const groups: SearchGroup[] = [];

    if (accounts.length > 0) {
      groups.push({
        entity: "account",
        label: "계정과목",
        items: accounts.map((a) => ({
          id: a.id,
          title: `${a.code} ${a.name}`,
          subtitle: a.type,
          link: "/accounts",
        })),
      });
    }

    if (vendors.length > 0) {
      groups.push({
        entity: "vendor",
        label: "거래처",
        items: vendors.map((v) => ({
          id: v.id,
          title: v.name,
          subtitle: v.bizNo || undefined,
          link: "/vendors",
        })),
      });
    }

    if (journals.length > 0) {
      groups.push({
        entity: "journal",
        label: "전표",
        items: journals.map((j) => ({
          id: j.id,
          title: j.description || "(적요 없음)",
          subtitle: new Date(j.date).toLocaleDateString("ko-KR"),
          link: "/journals",
        })),
      });
    }

    if (taxInvoices.length > 0) {
      groups.push({
        entity: "taxInvoice",
        label: "세금계산서",
        items: taxInvoices.map((t) => ({
          id: t.id,
          title: t.invoiceNo || t.issuerName,
          subtitle: t.recipientName,
          link: "/tax-invoices",
        })),
      });
    }

    if (projects.length > 0) {
      groups.push({
        entity: "project",
        label: "프로젝트",
        items: projects.map((p) => ({
          id: p.id,
          title: `${p.code} ${p.name}`,
          subtitle: p.status,
          link: "/projects",
        })),
      });
    }

    if (departments.length > 0) {
      groups.push({
        entity: "department",
        label: "부서",
        items: departments.map((d) => ({
          id: d.id,
          title: `${d.code} ${d.name}`,
          subtitle: d.manager || undefined,
          link: "/departments",
        })),
      });
    }

    if (products.length > 0) {
      groups.push({
        entity: "product",
        label: "품목",
        items: products.map((p) => ({
          id: p.id,
          title: `${p.code} ${p.name}`,
          subtitle: p.category || undefined,
          link: "/cost-management",
        })),
      });
    }

    if (trades.length > 0) {
      groups.push({
        entity: "trade",
        label: "매출/매입",
        items: trades.map((t) => ({
          id: t.id,
          title: t.tradeNo,
          subtitle: t.description || undefined,
          link: "/trades",
        })),
      });
    }

    if (expenseClaims.length > 0) {
      groups.push({
        entity: "expenseClaim",
        label: "경비 정산",
        items: expenseClaims.map((e) => ({
          id: e.id,
          title: `${e.claimNo} ${e.title}`,
          subtitle: e.status,
          link: "/expense-claims",
        })),
      });
    }

    if (fixedAssets.length > 0) {
      groups.push({
        entity: "fixedAsset",
        label: "고정자산",
        items: fixedAssets.map((f) => ({
          id: f.id,
          title: f.name,
          subtitle: f.status,
          link: "/fixed-assets",
        })),
      });
    }

    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

    return { results: groups, totalCount };
  }
}
