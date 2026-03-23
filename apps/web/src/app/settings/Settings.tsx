"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocale } from "@/lib/locale";
import { apiPatch } from "@/lib/api";
import type { Tab } from "./types";
import { NOTIF_KEYS } from "./types";
import SettingsForm from "./SettingsForm";
import styles from "./Settings.module.css";

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
        <SettingsForm
          tab="profile"
          user={user}
          name={name}
          role={role || ""}
          onNameChange={setName}
          onSave={handleProfileSave}
          saving={profileSaving}
          message={profileMsg}
          t={t}
        />
      )}

      {tab === "password" && (
        <SettingsForm
          tab="password"
          currentPw={currentPw}
          newPw={newPw}
          confirmPw={confirmPw}
          onCurrentPwChange={setCurrentPw}
          onNewPwChange={setNewPw}
          onConfirmPwChange={setConfirmPw}
          onSave={handlePasswordChange}
          saving={pwSaving}
          message={pwMsg}
          t={t}
        />
      )}

      {tab === "notifications" && (
        <SettingsForm
          tab="notifications"
          theme={theme}
          locale={locale}
          notifSettings={notifSettings}
          onThemeChange={setTheme}
          onLocaleChange={setLocale}
          onToggleNotif={toggleNotif}
          t={t}
        />
      )}
    </div>
  );
}
