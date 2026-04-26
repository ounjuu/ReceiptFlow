"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { creditRatingLabel, creditRatingColor } from "../types";
import styles from "./VendorDetail.module.css";

interface VendorMemo {
  id: string;
  content: string;
  memoType: string;
  userName: string | null;
  createdAt: string;
}

interface Trade {
  id: string;
  tradeNo: string;
  tradeType: string;
  tradeDate: string;
  totalAmount: string;
  status: string;
}

interface TaxInvoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  invoiceDate: string;
  totalAmount: string;
}

interface VendorDetail {
  id: string;
  name: string;
  bizNo: string | null;
  creditRating: string | null;
  creditLimit: string;
  note: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  category: string | null;
  createdAt: string;
  memos: VendorMemo[];
  trades: Trade[];
  taxInvoices: TaxInvoice[];
}

const MEMO_TYPES = [
  { code: "NOTE", label: "메모", icon: "M" },
  { code: "CALL", label: "전화", icon: "C" },
  { code: "MEETING", label: "미팅", icon: "T" },
  { code: "EMAIL", label: "이메일", icon: "E" },
] as const;

function memoTypeIcon(type: string) {
  return MEMO_TYPES.find((t) => t.code === type)?.icon || "M";
}

function memoTypeLabel(type: string) {
  return MEMO_TYPES.find((t) => t.code === type)?.label || "메모";
}

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [memoContent, setMemoContent] = useState("");
  const [memoType, setMemoType] = useState("NOTE");

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-detail", id],
    queryFn: () => apiGet<VendorDetail>(`/vendors/${id}/detail`),
    enabled: !!id,
  });

  const addMemoMutation = useMutation({
    mutationFn: (body: { content: string; memoType: string }) =>
      apiPost(`/vendors/${id}/memos`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
      setMemoContent("");
    },
    onError: (err: Error) => alert(err.message),
  });

  const deleteMemoMutation = useMutation({
    mutationFn: (memoId: string) => apiDelete(`/vendors/memos/${memoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleAddMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoContent.trim()) return;
    addMemoMutation.mutate({ content: memoContent.trim(), memoType });
  };

  const handleDeleteMemo = (memoId: string) => {
    if (confirm("메모를 삭제하시겠습니까?")) {
      deleteMemoMutation.mutate(memoId);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (!vendor) {
    return <div className={styles.loading}>거래처를 찾을 수 없습니다.</div>;
  }

  return (
    <div>
      <Link href="/vendors" className={styles.backLink}>
        &larr; 목록으로
      </Link>
      <h1 className={styles.title}>{vendor.name}</h1>

      <div className={styles.grid}>
        {/* 기본 정보 카드 */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>기본 정보</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>사업자등록번호</span>
              <span className={styles.infoValue}>{vendor.bizNo || "-"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>신용등급</span>
              <span className={styles.infoValue}>
                {vendor.creditRating ? (
                  <span
                    className={styles.badge}
                    style={{ backgroundColor: creditRatingColor(vendor.creditRating) }}
                  >
                    {creditRatingLabel(vendor.creditRating)}
                  </span>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>거래한도</span>
              <span className={styles.infoValue}>
                {Number(vendor.creditLimit || 0).toLocaleString()}원
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>분류</span>
              <span className={styles.infoValue}>{vendor.category || "-"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>담당자</span>
              <span className={styles.infoValue}>{vendor.contactName || "-"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>연락처</span>
              <span className={styles.infoValue}>{vendor.contactPhone || "-"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>이메일</span>
              <span className={styles.infoValue}>{vendor.contactEmail || "-"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>주소</span>
              <span className={styles.infoValue}>{vendor.address || "-"}</span>
            </div>
          </div>
        </div>

        {/* 최근 거래 카드 */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>최근 거래 (5건)</h2>
          {vendor.trades.length > 0 ? (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>거래번호</th>
                  <th>유형</th>
                  <th>일자</th>
                  <th>금액</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {vendor.trades.map((t) => (
                  <tr key={t.id}>
                    <td>{t.tradeNo}</td>
                    <td>{t.tradeType === "SALE" ? "매출" : "매입"}</td>
                    <td>{new Date(t.tradeDate).toLocaleDateString("ko-KR")}</td>
                    <td style={{ textAlign: "right" }}>
                      {Number(t.totalAmount).toLocaleString()}
                    </td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyMsg}>최근 거래가 없습니다.</p>
          )}
        </div>

        {/* 메모/활동 히스토리 카드 */}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>메모 / 활동 히스토리</h2>

          <form className={styles.memoForm} onSubmit={handleAddMemo}>
            <input
              className={styles.memoInput}
              placeholder="메모를 입력하세요..."
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
            />
            <select
              className={styles.memoSelect}
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
            >
              {MEMO_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={styles.memoSubmitBtn}
              disabled={addMemoMutation.isPending || !memoContent.trim()}
            >
              {addMemoMutation.isPending ? "저장 중..." : "추가"}
            </button>
          </form>

          {vendor.memos.length > 0 ? (
            <div className={styles.timeline}>
              {vendor.memos.map((memo) => (
                <div key={memo.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} data-type={memo.memoType}>
                    {memoTypeIcon(memo.memoType)}
                  </div>
                  <div className={styles.timelineContent}>{memo.content}</div>
                  <div className={styles.timelineMeta}>
                    <span>{memoTypeLabel(memo.memoType)}</span>
                    <span>{memo.userName || "-"}</span>
                    <span>
                      {new Date(memo.createdAt).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteMemo(memo.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMsg}>등록된 메모가 없습니다.</p>
          )}
        </div>

        {/* 최근 세금계산서 카드 */}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>최근 세금계산서 (5건)</h2>
          {vendor.taxInvoices.length > 0 ? (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>계산서번호</th>
                  <th>유형</th>
                  <th>발행일</th>
                  <th>금액</th>
                </tr>
              </thead>
              <tbody>
                {vendor.taxInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNo}</td>
                    <td>{inv.invoiceType === "SALES" ? "매출" : "매입"}</td>
                    <td>{new Date(inv.invoiceDate).toLocaleDateString("ko-KR")}</td>
                    <td style={{ textAlign: "right" }}>
                      {Number(inv.totalAmount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyMsg}>최근 세금계산서가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
