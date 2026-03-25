"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import styles from "./Login.module.css";

type Mode = "login" | "signup";

export default function LoginPage() {
  const { login, signup } = useAuth();
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (password !== passwordConfirm) {
        setError(t("login_passwordMismatch"));
        return;
      }
      if (password.length < 6) {
        setError(t("settings_passwordMin"));
        return;
      }
      if (!name.trim()) {
        setError(t("login_name"));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError("");
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.branding}>
        <div className={styles.brandLogo}>LedgerFlow</div>
        <p className={styles.brandTagline}>
          AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템
        </p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </span>
            영수증 OCR + AI 자동 분류
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            전표 자동 생성 + 전자결재
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            재무제표 + 예산 관리
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </span>
            홈택스 연동 + 전자신고
          </div>
        </div>
      </div>

      <div className={styles.formSide}>
        <div className={styles.card}>
          <div className={styles.logo}>{t("login_title")}</div>
          <p className={styles.subtitle}>{t("login_subtitle")}</p>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
              onClick={() => switchMode("login")}
            >
              {t("login_tab")}
            </button>
            <button
              className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
              onClick={() => switchMode("signup")}
            >
              {t("signup_tab")}
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className={styles.field}>
                <label className={styles.label}>{t("login_name")}</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>{t("login_email")}</label>
              <input
                className={styles.input}
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t("login_password")}</label>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === "signup" && (
              <div className={styles.field}>
                <label className={styles.label}>{t("login_passwordConfirm")}</label>
                <input
                  className={styles.input}
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading
                ? "..."
                : mode === "login"
                  ? t("login_btn")
                  : t("signup_btn")}
            </button>
          </form>

          {mode === "login" && (
            <p className={styles.info}>
              테스트: admin@ledgerflow.dev / admin1234
            </p>
          )}

          <div className={styles.footer}>
            LedgerFlow ERP
          </div>
        </div>
      </div>
    </div>
  );
}
