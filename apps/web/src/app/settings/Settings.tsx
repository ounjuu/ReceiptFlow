"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocale } from "@/lib/locale";
import type { Locale } from "@/lib/locale";
import { apiPatch } from "@/lib/api";
import styles from "./Settings.module.css";

const LANG_OPTIONS: { value: Locale; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];

type Tab = "profile" | "password" | "notifications";

type NotifKeyDef = { key: string; labelKey: "settings_notifJournal" | "settings_notifClosing" | "settings_notifDocument" | "settings_notifInventory" | "settings_notifExpense"; descKey: "settings_notifJournalDesc" | "settings_notifClosingDesc" | "settings_notifDocumentDesc" | "settings_notifInventoryDesc" | "settings_notifExpenseDesc" };

const NOTIF_KEYS: NotifKeyDef[] = [
  { key: "notif_journal", labelKey: "settings_notifJournal", descKey: "settings_notifJournalDesc" },
  { key: "notif_closing", labelKey: "settings_notifClosing", descKey: "settings_notifClosingDesc" },
  { key: "notif_document", labelKey: "settings_notifDocument", descKey: "settings_notifDocumentDesc" },
  { key: "notif_inventory", labelKey: "settings_notifInventory", descKey: "settings_notifInventoryDesc" },
  { key: "notif_expense", labelKey: "settings_notifExpense", descKey: "settings_notifExpenseDesc" },
];

type ThemeOptDef = { value: "light" | "dark" | "system"; labelKey: "settings_themeLight" | "settings_themeDark" | "settings_themeSystem"; descKey: "settings_themeLightDesc" | "settings_themeDarkDesc" | "settings_themeSystemDesc" };

const THEME_OPTIONS: ThemeOptDef[] = [
  { value: "light", labelKey: "settings_themeLight", descKey: "settings_themeLightDesc" },
  { value: "dark", labelKey: "settings_themeDark", descKey: "settings_themeDarkDesc" },
  { value: "system", labelKey: "settings_themeSystem", descKey: "settings_themeSystemDesc" },
];

export default function Settings() {
  const { user, role, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [tab, setTab] = useState<Tab>("profile");

  // 프로필 탭
  const [name, setName] = useState(user?.name ?? "");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // 비밀번호 탭
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // 알림 설정 탭
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  // localStorage에서 알림 설정 로드
  useEffect(() => {
    const saved = localStorage.getItem("notifSettings");
    if (saved) {
      setNotifSettings(JSON.parse(saved));
    } else {
      const defaults: Record<string, boolean> = {};
      NOTIF_KEYS.forEach((n) => (defaults[n.key] = true));
      setNotifSettings(defaults);
    }
  }, []);

  const handleProfileSave = async () => {
    if (!name.trim()) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await apiPatch("/auth/me", { name: name.trim() });
      await refreshUser();
      setProfileMsg({ type: "success", text: t("settings_saved") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("settings_saveFailed");
      setProfileMsg({ type: "error", text: msg });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: "error", text: t("settings_passwordMin") });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: t("settings_passwordMismatch") });
      return;
    }
    setPwSaving(true);
    try {
      await apiPatch("/auth/me/password", { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ type: "success", text: t("settings_passwordChanged") });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("settings_passwordFailed");
      setPwMsg({ type: "error", text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  const toggleNotif = (key: string) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    localStorage.setItem("notifSettings", JSON.stringify(updated));
  };

  if (!user) return null;

  return (
    <div>
      <h1 className={styles.title}>{t("settings_title")}</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "profile" ? styles.tabActive : ""}`}
          onClick={() => setTab("profile")}
        >
          {t("settings_profile")}
        </button>
        <button
          className={`${styles.tab} ${tab === "password" ? styles.tabActive : ""}`}
          onClick={() => setTab("password")}
        >
          {t("settings_password")}
        </button>
        <button
          className={`${styles.tab} ${tab === "notifications" ? styles.tabActive : ""}`}
          onClick={() => setTab("notifications")}
        >
          {t("settings_notifications")}
        </button>
      </div>

      {tab === "profile" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings_profileTitle")}</h2>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_email")}</label>
            <input className={styles.input} value={user.email} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_name")}</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings_namePlaceholder")}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_role")}</label>
            <div className={styles.readonlyValue}>{t(`role_${role}` as "role_ADMIN" | "role_ACCOUNTANT" | "role_VIEWER")}</div>
          </div>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleProfileSave}
            disabled={profileSaving || !name.trim()}
          >
            {profileSaving ? t("settings_saving") : t("settings_save")}
          </button>
          {profileMsg && (
            <div className={`${styles.msg} ${profileMsg.type === "success" ? styles.msgSuccess : styles.msgError}`}>
              {profileMsg.text}
            </div>
          )}
        </div>
      )}

      {tab === "password" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings_passwordTitle")}</h2>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_currentPassword")}</label>
            <input
              className={styles.input}
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_newPassword")}</label>
            <input
              className={styles.input}
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder={t("settings_newPasswordPlaceholder")}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t("settings_confirmPassword")}</label>
            <input
              className={styles.input}
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handlePasswordChange}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
          >
            {pwSaving ? t("settings_changingPassword") : t("settings_changePassword")}
          </button>
          {pwMsg && (
            <div className={`${styles.msg} ${pwMsg.type === "success" ? styles.msgSuccess : styles.msgError}`}>
              {pwMsg.text}
            </div>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings_theme")}</h2>
          <div className={styles.radioGroup}>
            {THEME_OPTIONS.map((opt) => (
              <label key={opt.value} className={`${styles.radioItem} ${theme === opt.value ? styles.radioActive : ""}`}>
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={theme === opt.value}
                  onChange={() => setTheme(opt.value)}
                  className={styles.radioInput}
                />
                <div>
                  <div className={styles.toggleLabel}>{t(opt.labelKey)}</div>
                  <div className={styles.toggleDesc}>{t(opt.descKey)}</div>
                </div>
              </label>
            ))}
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>{t("settings_language")}</h2>
          <div className={styles.radioGroup}>
            {LANG_OPTIONS.map((opt) => (
              <label key={opt.value} className={`${styles.radioItem} ${locale === opt.value ? styles.radioActive : ""}`}>
                <input
                  type="radio"
                  name="locale"
                  value={opt.value}
                  checked={locale === opt.value}
                  onChange={() => setLocale(opt.value)}
                  className={styles.radioInput}
                />
                <div>
                  <div className={styles.toggleLabel}>{opt.label}</div>
                </div>
              </label>
            ))}
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>{t("settings_notifTitle")}</h2>
          <div className={styles.toggleList}>
            {NOTIF_KEYS.map((n) => (
              <div key={n.key} className={styles.toggleItem}>
                <div>
                  <div className={styles.toggleLabel}>{t(n.labelKey)}</div>
                  <div className={styles.toggleDesc}>{t(n.descKey)}</div>
                </div>
                <label className={styles.switch}>
                  <input
                    className={styles.switchInput}
                    type="checkbox"
                    checked={notifSettings[n.key] ?? true}
                    onChange={() => toggleNotif(n.key)}
                  />
                  <span className={styles.switchSlider} />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
