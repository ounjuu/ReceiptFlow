"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { apiPatch } from "@/lib/api";
import styles from "./Settings.module.css";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  ACCOUNTANT: "회계담당",
  VIEWER: "열람자",
};

type Tab = "profile" | "password" | "notifications";

const NOTIF_KEYS = [
  { key: "notif_journal", label: "전표 승인 알림", desc: "전표가 승인 대기/전기 대기일 때 알림" },
  { key: "notif_closing", label: "마감 임박 알림", desc: "월말 마감일이 가까울 때 알림" },
  { key: "notif_document", label: "영수증 처리 알림", desc: "처리 대기 중인 영수증이 있을 때 알림" },
  { key: "notif_inventory", label: "재고 부족 알림", desc: "재고가 안전재고 이하일 때 알림" },
  { key: "notif_expense", label: "경비 정산 알림", desc: "경비 정산 대기 건이 있을 때 알림" },
];

const THEME_OPTIONS = [
  { value: "light", label: "라이트", desc: "밝은 테마" },
  { value: "dark", label: "다크", desc: "어두운 테마" },
  { value: "system", label: "시스템", desc: "OS 설정에 따라 자동 전환" },
] as const;

export default function Settings() {
  const { user, role, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
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
      setProfileMsg({ type: "success", text: "프로필이 저장되었습니다" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다";
      setProfileMsg({ type: "error", text: msg });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: "error", text: "새 비밀번호는 6자 이상이어야 합니다" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "새 비밀번호가 일치하지 않습니다" });
      return;
    }
    setPwSaving(true);
    try {
      await apiPatch("/auth/me/password", { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ type: "success", text: "비밀번호가 변경되었습니다" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "비밀번호 변경에 실패했습니다";
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
      <h1 className={styles.title}>설정</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "profile" ? styles.tabActive : ""}`}
          onClick={() => setTab("profile")}
        >
          프로필
        </button>
        <button
          className={`${styles.tab} ${tab === "password" ? styles.tabActive : ""}`}
          onClick={() => setTab("password")}
        >
          비밀번호 변경
        </button>
        <button
          className={`${styles.tab} ${tab === "notifications" ? styles.tabActive : ""}`}
          onClick={() => setTab("notifications")}
        >
          알림 설정
        </button>
      </div>

      {tab === "profile" && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>프로필 정보</h2>
          <div className={styles.field}>
            <label className={styles.label}>이메일</label>
            <input className={styles.input} value={user.email} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>이름</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>역할</label>
            <div className={styles.readonlyValue}>{ROLE_LABEL[role ?? ""] ?? role}</div>
          </div>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleProfileSave}
            disabled={profileSaving || !name.trim()}
          >
            {profileSaving ? "저장 중..." : "저장"}
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
          <h2 className={styles.sectionTitle}>비밀번호 변경</h2>
          <div className={styles.field}>
            <label className={styles.label}>현재 비밀번호</label>
            <input
              className={styles.input}
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>새 비밀번호</label>
            <input
              className={styles.input}
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="6자 이상"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>새 비밀번호 확인</label>
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
            {pwSaving ? "변경 중..." : "비밀번호 변경"}
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
          <h2 className={styles.sectionTitle}>테마</h2>
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
                  <div className={styles.toggleLabel}>{opt.label}</div>
                  <div className={styles.toggleDesc}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>알림</h2>
          <div className={styles.toggleList}>
            {NOTIF_KEYS.map((n) => (
              <div key={n.key} className={styles.toggleItem}>
                <div>
                  <div className={styles.toggleLabel}>{n.label}</div>
                  <div className={styles.toggleDesc}>{n.desc}</div>
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
