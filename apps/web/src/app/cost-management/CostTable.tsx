"use client";

import styles from "./CostManagement.module.css";
import { exportToXlsx } from "@/lib/export-xlsx";
import type { Product, ItemCost, VendorCost, ProjectCost, DeptCost, VarianceRow } from "./types";
import { fmt } from "./types";

export interface CostTableProps {
  tab: "manage" | "analysis" | "variance";
  analysisView: "item" | "vendor" | "project" | "dept";
  products: Product[];
  canEdit: boolean;
  canDelete: boolean;
  onStartEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onAnalysisViewChange: (v: "item" | "vendor" | "project" | "dept") => void;
  itemData: { items: ItemCost[]; totalAmount: number } | undefined;
  vendorData: { vendors: VendorCost[]; totalAmount: number } | undefined;
  projectData: { projects: ProjectCost[]; totalCost: number } | undefined;
  deptData: { departments: DeptCost[]; totalCost: number } | undefined;
  varianceData: { variances: VarianceRow[]; totalActual: number; totalStandard: number; totalVariance: number } | undefined;
}

function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}) {
  return (
    <div className={styles.filterRow}>
      <input className={styles.formInput} type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} style={{ width: 150 }} />
      <span className={styles.unit}>~</span>
      <input className={styles.formInput} type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} style={{ width: 150 }} />
    </div>
  );
}

export default function CostTable({
  tab,
  analysisView,
  products,
  canEdit,
  canDelete,
  onStartEdit,
  onDelete,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onAnalysisViewChange,
  itemData,
  vendorData,
  projectData,
  deptData,
  varianceData,
}: CostTableProps) {
  const dateFilter = (
    <DateFilter
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={onStartDateChange}
      onEndDateChange={onEndDateChange}
    />
  );

  return (
    <>
      {/* 품목 관리 탭 - 테이블 */}
      {tab === "manage" && (
        <table>
          <thead>
            <tr>
              <th>코드</th>
              <th>품목명</th>
              <th>카테고리</th>
              <th>단위</th>
              <th style={{ textAlign: "right" }}>표준원가</th>
              <th style={{ textAlign: "right" }}>안전재고</th>
              <th>설명</th>
              {(canEdit || canDelete) && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.category || "-"}</td>
                <td>{p.unit || "-"}</td>
                <td style={{ textAlign: "right" }}>{p.standardCost != null ? `${fmt(p.standardCost)}원` : "-"}</td>
                <td style={{ textAlign: "right" }}>{p.safetyStock > 0 ? fmt(p.safetyStock) : "-"}</td>
                <td>{p.description || "-"}</td>
                {(canEdit || canDelete) && (
                  <td>
                    <div className={styles.actions}>
                      {canEdit && <button className={styles.editBtn} onClick={() => onStartEdit(p)}>수정</button>}
                      {canDelete && (
                        <button className={styles.dangerBtn} onClick={() => onDelete(p)}>
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={(canEdit || canDelete) ? 8 : 7} style={{ textAlign: "center", color: "var(--text-muted)" }}>등록된 품목이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* 원가 분석 탭 */}
      {tab === "analysis" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>원가 분석</h2>
            {dateFilter}
          </div>

          <div className={styles.subTabs}>
            {([["item", "품목별"], ["vendor", "거래처별"], ["project", "프로젝트별"], ["dept", "부서별"]] as const).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.subTab} ${analysisView === key ? styles.subTabActive : ""}`}
                onClick={() => onAnalysisViewChange(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 품목별 */}
          {analysisView === "item" && itemData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 매입원가: {fmt(itemData.totalAmount)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("품목별_원가분석", "품목별", ["품목명", "수량", "총액", "평균단가", "건수"],
                    itemData.items.map((i) => [i.itemName, i.totalQty, i.totalAmount, i.avgUnitCost, i.tradeCount]));
                }} disabled={itemData.items.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>품목명</th><th style={{ textAlign: "right" }}>수량</th><th style={{ textAlign: "right" }}>총액</th><th style={{ textAlign: "right" }}>평균단가</th><th style={{ textAlign: "right" }}>매입건수</th></tr></thead>
                <tbody>
                  {itemData.items.map((i) => (
                    <tr key={i.itemName}><td>{i.itemName}</td><td style={{ textAlign: "right" }}>{fmt(i.totalQty)}</td><td style={{ textAlign: "right" }}>{fmt(i.totalAmount)}원</td><td style={{ textAlign: "right" }}>{fmt(i.avgUnitCost)}원</td><td style={{ textAlign: "right" }}>{i.tradeCount}</td></tr>
                  ))}
                  {itemData.items.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 거래처별 */}
          {analysisView === "vendor" && vendorData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 매입원가: {fmt(vendorData.totalAmount)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("거래처별_원가분석", "거래처별", ["거래처", "사업자번호", "총액", "건수"],
                    vendorData.vendors.map((v) => [v.vendorName, v.bizNo || "", v.totalAmount, v.tradeCount]));
                }} disabled={vendorData.vendors.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>거래처</th><th>사업자번호</th><th style={{ textAlign: "right" }}>총 매입액</th><th style={{ textAlign: "right" }}>거래건수</th></tr></thead>
                <tbody>
                  {vendorData.vendors.map((v) => (
                    <tr key={v.vendorId}><td>{v.vendorName}</td><td>{v.bizNo || "-"}</td><td style={{ textAlign: "right" }}>{fmt(v.totalAmount)}원</td><td style={{ textAlign: "right" }}>{v.tradeCount}</td></tr>
                  ))}
                  {vendorData.vendors.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 프로젝트별 */}
          {analysisView === "project" && projectData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 비용: {fmt(projectData.totalCost)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("프로젝트별_원가분석", "프로젝트별", ["코드", "프로젝트명", "비용"],
                    projectData.projects.map((p) => [p.code, p.name, p.totalCost]));
                }} disabled={projectData.projects.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>코드</th><th>프로젝트명</th><th style={{ textAlign: "right" }}>비용</th></tr></thead>
                <tbody>
                  {projectData.projects.map((p) => (
                    <tr key={p.projectId}><td>{p.code}</td><td>{p.name}</td><td style={{ textAlign: "right" }}>{fmt(p.totalCost)}원</td></tr>
                  ))}
                  {projectData.projects.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {/* 부서별 */}
          {analysisView === "dept" && deptData && (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.unit}>총 비용: {fmt(deptData.totalCost)}원</span>
                <button className={styles.downloadBtn} onClick={() => {
                  exportToXlsx("부서별_원가분석", "부서별", ["코드", "부서명", "비용"],
                    deptData.departments.map((d) => [d.code, d.name, d.totalCost]));
                }} disabled={deptData.departments.length === 0}>엑셀 다운로드</button>
              </div>
              <table>
                <thead><tr><th>코드</th><th>부서명</th><th style={{ textAlign: "right" }}>비용</th></tr></thead>
                <tbody>
                  {deptData.departments.map((d) => (
                    <tr key={d.departmentId}><td>{d.code}</td><td>{d.name}</td><td style={{ textAlign: "right" }}>{fmt(d.totalCost)}원</td></tr>
                  ))}
                  {deptData.departments.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>데이터 없음</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* 원가 차이분석 탭 */}
      {tab === "variance" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>표준원가 vs 실제원가</h2>
            <div className={styles.sectionHeaderRight}>
              {dateFilter}
              <button className={styles.downloadBtn} onClick={() => {
                if (!varianceData) return;
                exportToXlsx("원가차이분석", "차이분석",
                  ["품목명", "코드", "카테고리", "수량", "표준단가", "실제단가", "표준총액", "실제총액", "차이", "차이율(%)"],
                  varianceData.variances.map((v) => [
                    v.itemName, v.productCode || "-", v.category || "-", v.quantity,
                    v.standardCost ?? "-", v.actualUnitCost, v.standardTotal ?? "-",
                    v.actualTotal, v.variance ?? "-", v.varianceRate ?? "-",
                  ]));
              }} disabled={!varianceData || varianceData.variances.length === 0}>엑셀 다운로드</button>
            </div>
          </div>

          {varianceData && (
            <>
              <div className={styles.summaryCards} style={{ marginBottom: 20 }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>표준원가 합계</div>
                  <div className={styles.summaryValue}>{fmt(varianceData.totalStandard)}원</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>실제원가 합계</div>
                  <div className={styles.summaryValue}>{fmt(varianceData.totalActual)}원</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 차이</div>
                  <div className={`${styles.summaryValue} ${varianceData.totalVariance > 0 ? styles.negative : styles.positive}`}>
                    {varianceData.totalVariance > 0 ? "+" : ""}{fmt(varianceData.totalVariance)}원
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>차이율</div>
                  <div className={`${styles.summaryValue} ${varianceData.totalVariance > 0 ? styles.negative : styles.positive}`}>
                    {varianceData.totalStandard > 0
                      ? `${Math.round((varianceData.totalVariance / varianceData.totalStandard) * 1000) / 10}%`
                      : "-"}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>코드</th>
                    <th>카테고리</th>
                    <th style={{ textAlign: "right" }}>수량</th>
                    <th style={{ textAlign: "right" }}>표준단가</th>
                    <th style={{ textAlign: "right" }}>실제단가</th>
                    <th style={{ textAlign: "right" }}>표준총액</th>
                    <th style={{ textAlign: "right" }}>실제총액</th>
                    <th style={{ textAlign: "right" }}>차이</th>
                    <th style={{ textAlign: "right" }}>차이율</th>
                  </tr>
                </thead>
                <tbody>
                  {varianceData.variances.map((v) => (
                    <tr key={v.itemName}>
                      <td>{v.itemName}</td>
                      <td>{v.productCode || "-"}</td>
                      <td>{v.category || "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.quantity)}{v.unit ? ` ${v.unit}` : ""}</td>
                      <td style={{ textAlign: "right" }}>{v.standardCost != null ? `${fmt(v.standardCost)}원` : <span className={styles.noStandard}>미설정</span>}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.actualUnitCost)}원</td>
                      <td style={{ textAlign: "right" }}>{v.standardTotal != null ? `${fmt(v.standardTotal)}원` : "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(v.actualTotal)}원</td>
                      <td style={{ textAlign: "right" }}>
                        {v.variance != null ? (
                          <span className={v.variance > 0 ? styles.variancePositive : v.variance < 0 ? styles.varianceNegative : styles.varianceZero}>
                            {v.variance > 0 ? "+" : ""}{fmt(v.variance)}원
                          </span>
                        ) : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {v.varianceRate != null ? (
                          <span className={v.varianceRate > 0 ? styles.variancePositive : v.varianceRate < 0 ? styles.varianceNegative : styles.varianceZero}>
                            {v.varianceRate > 0 ? "+" : ""}{v.varianceRate}%
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                  {varianceData.variances.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)" }}>매입 데이터가 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}
