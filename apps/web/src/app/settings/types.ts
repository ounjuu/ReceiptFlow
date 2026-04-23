import type { Locale } from "@/lib/locale";

export type Tab = "profile" | "password" | "notifications" | "permissions" | "backup";

export type NotifKeyDef = {
  key: string;
  labelKey: "settings_notifJournal" | "settings_notifClosing" | "settings_notifDocument" | "settings_notifInventory" | "settings_notifExpense";
  descKey: "settings_notifJournalDesc" | "settings_notifClosingDesc" | "settings_notifDocumentDesc" | "settings_notifInventoryDesc" | "settings_notifExpenseDesc";
};

export type ThemeOptDef = {
  value: "light" | "dark" | "system";
  labelKey: "settings_themeLight" | "settings_themeDark" | "settings_themeSystem";
  descKey: "settings_themeLightDesc" | "settings_themeDarkDesc" | "settings_themeSystemDesc";
};

export const NOTIF_KEYS: NotifKeyDef[] = [
  { key: "notif_journal", labelKey: "settings_notifJournal", descKey: "settings_notifJournalDesc" },
  { key: "notif_closing", labelKey: "settings_notifClosing", descKey: "settings_notifClosingDesc" },
  { key: "notif_document", labelKey: "settings_notifDocument", descKey: "settings_notifDocumentDesc" },
  { key: "notif_inventory", labelKey: "settings_notifInventory", descKey: "settings_notifInventoryDesc" },
  { key: "notif_expense", labelKey: "settings_notifExpense", descKey: "settings_notifExpenseDesc" },
];

export const THEME_OPTIONS: ThemeOptDef[] = [
  { value: "light", labelKey: "settings_themeLight", descKey: "settings_themeLightDesc" },
  { value: "dark", labelKey: "settings_themeDark", descKey: "settings_themeDarkDesc" },
  { value: "system", labelKey: "settings_themeSystem", descKey: "settings_themeSystemDesc" },
];

export const LANG_OPTIONS: { value: Locale; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
