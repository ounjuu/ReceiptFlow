"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLocale } from "@/lib/locale";
import { apiGet, apiPatch, apiPut, apiDownload, apiPost } from "@/lib/api";
import type { Tab } from "./types";
import { NOTIF_KEYS } from "./types";
import SettingsForm from "./SettingsForm";
import PermissionsManager from "./PermissionsManager";
import type { Permission } from "./PermissionsManager";
import styles from "./Settings.module.css";

export default function Settings() {
  const { user, role, isAdmin, refreshUser } = useAuth();
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

  // 권한 관리 탭
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permMsg, setPermMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // 권한 탭 활성화 시 데이터 fetch
  useEffect(() => {
    if (tab === "permissions" && isAdmin && permissions.length === 0 && !permLoading) {
      setPermLoading(true);
      apiGet<Permission[]>("/auth/permissions")
        .then((data) => setPermissions(data))
        .catch(() => setPermMsg({ type: "error", text: t("perm_loadFailed") }))
        .finally(() => setPermLoading(false));
    }
  }, [tab, isAdmin, permissions.length, permLoading, t]);

  const handlePermSave = async (updated: Permission[]) => {
    setPermSaving(true);
    setPermMsg(null);
    try {
      await apiPut("/auth/permissions/batch", { permissions: updated });
      setPermissions(updated);
      setPermMsg({ type: "success", text: t("perm_saved") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("perm_saveFailed");
      setPermMsg({ type: "error", text: msg });
    } finally {
      setPermSaving(false);
    }
  };

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
        {isAdmin && (
          <button
            className={`${styles.tab} ${tab === "permissions" ? styles.tabActive : ""}`}
            onClick={() => setTab("permissions")}
          >
            {t("settings_permissions")}
          </button>
        )}
        {isAdmin && (
          <button
            className={`${styles.tab} ${tab === "backup" ? styles.tabActive : ""}`}
            onClick={() => setTab("backup")}
          >
            데이터 백업
          </button>
        )}
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

      {tab === "permissions" && isAdmin && (
        permLoading ? (
          <div className={styles.section}>
            <p>{t("perm_loading")}</p>
          </div>
        ) : (
          <PermissionsManager
            permissions={permissions}
            onSave={handlePermSave}
            saving={permSaving}
            message={permMsg}
            t={t}
          />
        )
      )}

      {tab === "backup" && isAdmin && <BackupSection />}
    </div>
  );
}

// 백업/복원 섹션
function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      await apiDownload("/backup/export", `ledgerflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setResult({ type: "success", text: "백업 파일이 다운로드되었습니다." });
    } catch (err) {
      setResult({ type: "error", text: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await apiPost<{ restored: number; message: string }>("/backup/import", backup);
      setResult({ type: "success", text: res.message });
    } catch (err) {
      setResult({ type: "error", text: (err as Error).message || "복원 실패" });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>데이터 백업 / 복원</h2>
      <p className={styles.sectionDesc}>
        현재 테넌트의 모든 데이터를 JSON 파일로 백업하거나 복원합니다.
      </p>

      <div className={styles.backupActions}>
        <div className={styles.backupCard}>
          <h3>백업 (내보내기)</h3>
          <p>계정과목, 전표, 거래처, 거래, 직원, 급여 등 전체 데이터를 JSON으로 다운로드합니다.</p>
          <button
            className={styles.primaryBtn}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "백업 중..." : "백업 다운로드"}
          </button>
        </div>

        <div className={styles.backupCard}>
          <h3>복원 (가져오기)</h3>
          <p>백업 JSON 파일을 업로드하여 데이터를 복원합니다. 기존 데이터와 중복되는 항목은 건너뜁니다.</p>
          <input type="file" ref={importRef} accept=".json" onChange={handleImport} hidden />
          <button
            className={styles.primaryBtn}
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            {importing ? "복원 중..." : "백업 파일 업로드"}
          </button>
        </div>
      </div>

      {result && (
        <p className={result.type === "success" ? styles.successMsg : styles.errorMsg}>
          {result.text}
        </p>
      )}
    </div>
  );
}
