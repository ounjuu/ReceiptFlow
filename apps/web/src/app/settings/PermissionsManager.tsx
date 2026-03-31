"use client";

import { useState, useEffect } from "react";
import type { TranslationKey } from "@/lib/translations";
import styles from "./Settings.module.css";

// 권한 데이터 구조
export interface Permission {
  module: string;
  role: string;
  read: boolean;
  write: boolean;
  delete: boolean;
}

interface Props {
  permissions: Permission[];
  onSave: (permissions: Permission[]) => void;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  t: (key: TranslationKey) => string;
}

const ROLES = ["ADMIN", "ACCOUNTANT", "VIEWER"] as const;

// 모듈 카테고리 그룹 (네비게이션과 동일한 구조)
const MODULE_GROUPS: { groupKey: TranslationKey; modules: { key: string; labelKey: TranslationKey }[] }[] = [
  {
    groupKey: "navGroup_home",
    modules: [
      { key: "dashboard", labelKey: "nav_dashboard" },
    ],
  },
  {
    groupKey: "navGroup_accounting",
    modules: [
      { key: "journals", labelKey: "nav_journals" },
      { key: "accounts", labelKey: "nav_accounts" },
      { key: "vendors", labelKey: "nav_vendors" },
      { key: "vendor-ledger", labelKey: "nav_vendorLedger" },
      { key: "documents", labelKey: "nav_documents" },
      { key: "journal-templates", labelKey: "nav_journalTemplates" },
      { key: "journal-rules", labelKey: "nav_journalRules" },
      { key: "approvals", labelKey: "nav_approvals" },
      { key: "closings", labelKey: "nav_closings" },
    ],
  },
  {
    groupKey: "navGroup_sales",
    modules: [
      { key: "trades", labelKey: "nav_trades" },
      { key: "tax-invoices", labelKey: "nav_taxInvoices" },
      { key: "expense-claims", labelKey: "nav_expenseClaims" },
      { key: "inventory", labelKey: "nav_inventory" },
      { key: "cost-management", labelKey: "nav_costManagement" },
    ],
  },
  {
    groupKey: "navGroup_finance",
    modules: [
      { key: "reports", labelKey: "nav_reports" },
      { key: "cash-flow", labelKey: "nav_cashFlow" },
      { key: "budgets", labelKey: "nav_budgets" },
      { key: "bank-accounts", labelKey: "nav_bankAccounts" },
      { key: "fixed-assets", labelKey: "nav_fixedAssets" },
      { key: "exchange-rates", labelKey: "nav_exchangeRates" },
    ],
  },
  {
    groupKey: "navGroup_tax",
    modules: [
      { key: "vat-returns", labelKey: "nav_vatReturns" },
      { key: "tax-filing", labelKey: "nav_taxFiling" },
      { key: "year-end-settlement", labelKey: "nav_yearEndSettlement" },
    ],
  },
  {
    groupKey: "navGroup_hr",
    modules: [
      { key: "payroll", labelKey: "nav_payroll" },
      { key: "departments", labelKey: "nav_departments" },
      { key: "projects", labelKey: "nav_projects" },
    ],
  },
  {
    groupKey: "navGroup_admin",
    modules: [
      { key: "members", labelKey: "nav_members" },
      { key: "audit-logs", labelKey: "nav_auditLogs" },
      { key: "settings", labelKey: "nav_settings" },
    ],
  },
];

// 모든 모듈 키 목록
const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

// 기본 권한 생성 (서버 데이터가 없는 모듈에 대해)
function buildDefaultPermissions(): Permission[] {
  const perms: Permission[] = [];
  for (const mod of ALL_MODULES) {
    for (const role of ROLES) {
      if (role === "ADMIN") {
        perms.push({ module: mod, role, read: true, write: true, delete: true });
      } else if (role === "ACCOUNTANT") {
        perms.push({ module: mod, role, read: true, write: true, delete: false });
      } else {
        perms.push({ module: mod, role, read: true, write: false, delete: false });
      }
    }
  }
  return perms;
}

export default function PermissionsManager({ permissions: initial, onSave, saving, message, t }: Props) {
  const [perms, setPerms] = useState<Permission[]>([]);

  useEffect(() => {
    // 서버에서 받은 데이터를 기본값과 병합
    const defaults = buildDefaultPermissions();
    const merged = defaults.map((def) => {
      const match = initial.find((p) => p.module === def.module && p.role === def.role);
      return match ?? def;
    });
    setPerms(merged);
  }, [initial]);

  const getPerm = (module: string, role: string): Permission => {
    return (
      perms.find((p) => p.module === module && p.role === role) ?? {
        module,
        role,
        read: false,
        write: false,
        delete: false,
      }
    );
  };

  const togglePerm = (module: string, role: string, field: "read" | "write" | "delete") => {
    if (role === "ADMIN") return; // ADMIN 권한은 변경 불가
    setPerms((prev) =>
      prev.map((p) => {
        if (p.module === module && p.role === role) {
          const updated = { ...p, [field]: !p[field] };
          // 쓰기/삭제를 켜면 읽기도 자동으로 켜기
          if (field === "write" && updated.write) updated.read = true;
          if (field === "delete" && updated.delete) {
            updated.read = true;
            updated.write = true;
          }
          // 읽기를 끄면 쓰기/삭제도 자동으로 끄기
          if (field === "read" && !updated.read) {
            updated.write = false;
            updated.delete = false;
          }
          // 쓰기를 끄면 삭제도 자동으로 끄기
          if (field === "write" && !updated.write) {
            updated.delete = false;
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleSave = () => {
    onSave(perms);
  };

  return (
    <div className={styles.permSection}>
      <h2 className={styles.sectionTitle}>{t("settings_permissions")}</h2>

      <div className={styles.permTableWrap}>
        <table className={styles.permTable}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}></th>
              {ROLES.map((role) => (
                <th key={role} className={styles.permRoleHeader}>
                  {t(`role_${role}` as TranslationKey)}
                  <span>{t("perm_read")} / {t("perm_write")} / {t("perm_delete")}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_GROUPS.map((group) => (
              <>
                <tr key={`group-${group.groupKey}`} className={styles.permGroup}>
                  <td colSpan={ROLES.length + 1}>{t(group.groupKey)}</td>
                </tr>
                {group.modules.map((mod) => (
                  <tr key={mod.key}>
                    <td className={styles.permModuleName}>{t(mod.labelKey)}</td>
                    {ROLES.map((role) => {
                      const perm = getPerm(mod.key, role);
                      const isAdmin = role === "ADMIN";
                      return (
                        <td key={role}>
                          <div className={styles.permCheckboxGroup}>
                            <label className={styles.permCheckbox}>
                              <input
                                type="checkbox"
                                checked={perm.read}
                                disabled={isAdmin}
                                onChange={() => togglePerm(mod.key, role, "read")}
                              />
                              R
                            </label>
                            <label className={styles.permCheckbox}>
                              <input
                                type="checkbox"
                                checked={perm.write}
                                disabled={isAdmin}
                                onChange={() => togglePerm(mod.key, role, "write")}
                              />
                              W
                            </label>
                            <label className={styles.permCheckbox}>
                              <input
                                type="checkbox"
                                checked={perm.delete}
                                disabled={isAdmin}
                                onChange={() => togglePerm(mod.key, role, "delete")}
                              />
                              D
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("perm_saving") : t("perm_save")}
        </button>
        {message && (
          <div className={`${styles.msg} ${message.type === "success" ? styles.msgSuccess : styles.msgError}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
