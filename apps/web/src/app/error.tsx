"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "3rem",
          fontWeight: 700,
          color: "var(--danger)",
        }}
      >
        오류 발생
      </div>
      <p
        style={{
          fontSize: "1rem",
          color: "var(--text-muted)",
          maxWidth: "480px",
          lineHeight: 1.6,
        }}
      >
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: "8px",
          padding: "10px 24px",
          background: "var(--primary)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius)",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
