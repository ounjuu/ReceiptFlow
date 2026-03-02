"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { apiGet, apiUpload, TENANT_ID } from "@/lib/api";
import styles from "./page.module.css";

interface Document {
  id: string;
  vendorName: string | null;
  transactionAt: string | null;
  totalAmount: string | null;
  status: string;
  imageUrl: string | null;
  createdAt: string;
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return { text: "대기", cls: styles.statusPending };
    case "OCR_DONE": return { text: "OCR 완료", cls: styles.statusOcr };
    case "JOURNAL_CREATED": return { text: "전표 생성", cls: styles.statusJournal };
    default: return { text: status, cls: "" };
  }
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiGet<Document[]>(`/documents?tenantId=${TENANT_ID}`),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tenantId", TENANT_ID);
      return apiUpload<Document>("/documents/upload", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (file) upload.mutate(file);
  };

  return (
    <div>
      <h1 className={styles.title}>영수증 관리</h1>

      <div className={styles.uploadSection}>
        <input type="file" ref={fileRef} accept="image/*" />
        <button
          className={styles.uploadBtn}
          onClick={handleUpload}
          disabled={upload.isPending}
        >
          {upload.isPending ? "업로드 중..." : "업로드"}
        </button>
      </div>

      <div className={styles.tableSection}>
        <table>
          <thead>
            <tr>
              <th>거래처</th>
              <th>거래일</th>
              <th>금액</th>
              <th>상태</th>
              <th>등록일</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const s = statusLabel(doc.status);
              return (
                <tr key={doc.id}>
                  <td>{doc.vendorName || "-"}</td>
                  <td>
                    {doc.transactionAt
                      ? new Date(doc.transactionAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td>
                    {doc.totalAmount
                      ? `${Number(doc.totalAmount).toLocaleString()}원`
                      : "-"}
                  </td>
                  <td>
                    <span className={`${styles.status} ${s.cls}`}>{s.text}</span>
                  </td>
                  <td>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  영수증이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
