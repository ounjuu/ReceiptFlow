"use client";

import type { Locale } from "@/lib/locale";
import type { TranslationKey } from "@/lib/translations";
import type { NotifKeyDef, ThemeOptDef } from "./types";
import { NOTIF_KEYS, THEME_OPTIONS, LANG_OPTIONS } from "./types";
import styles from "./Settings.module.css";

interface ProfileTabProps {
  tab: "profile";
  user: { email: string; name: string };
  name: string;
  role: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  t: (key: TranslationKey) => string;
}

interface PasswordTabProps {
  tab: "password";
  currentPw: string;
  newPw: string;
  confirmPw: string;
  onCurrentPwChange: (value: string) => void;
  onNewPwChange: (value: string) => void;
  onConfirmPwChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  t: (key: TranslationKey) => string;
}

interface NotificationsTabProps {
  tab: "notifications";
  theme: "light" | "dark" | "system";
  locale: Locale;
  notifSettings: Record<string, boolean>;
  onThemeChange: (value: "light" | "dark" | "system") => void;
  onLocaleChange: (value: Locale) => void;
  onToggleNotif: (key: string) => void;
  t: (key: TranslationKey) => string;
}

type SettingsFormProps = ProfileTabProps | PasswordTabProps | NotificationsTabProps;

export default function SettingsForm(props: SettingsFormProps) {
  const { t } = props;

  if (props.tab === "profile") {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings_profileTitle")}</h2>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_email")}</label>
          <input className={styles.input} value={props.user.email} disabled />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_name")}</label>
          <input
            className={styles.input}
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            placeholder={t("settings_namePlaceholder")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_role")}</label>
          <div className={styles.readonlyValue}>{t(`role_${props.role}` as TranslationKey)}</div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={props.onSave}
          disabled={props.saving || !props.name.trim()}
        >
          {props.saving ? t("settings_saving") : t("settings_save")}
        </button>
        {props.message && (
          <div className={`${styles.msg} ${props.message.type === "success" ? styles.msgSuccess : styles.msgError}`}>
            {props.message.text}
          </div>
        )}
      </div>
    );
  }

  if (props.tab === "password") {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings_passwordTitle")}</h2>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_currentPassword")}</label>
          <input
            className={styles.input}
            type="password"
            value={props.currentPw}
            onChange={(e) => props.onCurrentPwChange(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_newPassword")}</label>
          <input
            className={styles.input}
            type="password"
            value={props.newPw}
            onChange={(e) => props.onNewPwChange(e.target.value)}
            placeholder={t("settings_newPasswordPlaceholder")}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t("settings_confirmPassword")}</label>
          <input
            className={styles.input}
            type="password"
            value={props.confirmPw}
            onChange={(e) => props.onConfirmPwChange(e.target.value)}
          />
        </div>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={props.onSave}
          disabled={props.saving || !props.currentPw || !props.newPw || !props.confirmPw}
        >
          {props.saving ? t("settings_changingPassword") : t("settings_changePassword")}
        </button>
        {props.message && (
          <div className={`${styles.msg} ${props.message.type === "success" ? styles.msgSuccess : styles.msgError}`}>
            {props.message.text}
          </div>
        )}
      </div>
    );
  }

  // notifications tab
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t("settings_theme")}</h2>
      <div className={styles.radioGroup}>
        {THEME_OPTIONS.map((opt) => (
          <label key={opt.value} className={`${styles.radioItem} ${props.theme === opt.value ? styles.radioActive : ""}`}>
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={props.theme === opt.value}
              onChange={() => props.onThemeChange(opt.value)}
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
          <label key={opt.value} className={`${styles.radioItem} ${props.locale === opt.value ? styles.radioActive : ""}`}>
            <input
              type="radio"
              name="locale"
              value={opt.value}
              checked={props.locale === opt.value}
              onChange={() => props.onLocaleChange(opt.value)}
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
                checked={props.notifSettings[n.key] ?? true}
                onChange={() => props.onToggleNotif(n.key)}
              />
              <span className={styles.switchSlider} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
