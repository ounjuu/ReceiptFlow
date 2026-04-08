"use client";

import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - 4, totalPages - 9));
  const pages = Array.from({ length: Math.min(totalPages, 10) }, (_, i) => start + i).filter((p) => p <= totalPages);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "12px 0", borderTop: "1px solid var(--border)", marginTop: 12 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginRight: 8 }}>
        총 {total}건
      </span>
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={btnStyle}>
        이전
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          style={{ ...btnStyle, ...(p === page ? activeBtnStyle : {}) }}
        >
          {p}
        </button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={btnStyle}>
        다음
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  minWidth: 32, height: 32, padding: "0 8px",
  fontSize: "0.82rem", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", background: "#fff",
  color: "var(--text-muted)", cursor: "pointer",
};

const activeBtnStyle: React.CSSProperties = {
  background: "var(--primary)", color: "#fff", borderColor: "var(--primary)",
};
