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
      </div>
    </div>
  );
}
