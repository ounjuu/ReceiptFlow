"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import styles from "./FixedAssets.module.css";
import type {
  FixedAssetSummary,
  FixedAssetDetail,
  ScheduleData,
  AccountOption,
  DepResult,
} from "./types";
import { METHOD_LABEL, STATUS_LABEL } from "./types";
import FixedAssetForm from "./FixedAssetForm";
import FixedAssetTable from "./FixedAssetTable";

const now = new Date();

export default function FixedAssetsPage() {
  const { tenantId, canEdit, canDelete } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  // 등록 폼
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAssetAccountId, setFormAssetAccountId] = useState("");
  const [formDepAccountId, setFormDepAccountId] = useState("");
  const [formAccumAccountId, setFormAccumAccountId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formLifeMonths, setFormLifeMonths] = useState("");
  const [formResidual, setFormResidual] = useState("0");
  const [formMethod, setFormMethod] = useState("STRAIGHT_LINE");

  // 감가상각 실행
  const [depYear, setDepYear] = useState(now.getFullYear());
  const [depMonth, setDepMonth] = useState(now.getMonth() + 1);

  // 처분
  const [disposeDate, setDisposeDate] = useState("");
  const [disposeAmount, setDisposeAmount] = useState("");
  const [showDispose, setShowDispose] = useState(false);

  // 자산 목록
  const { data: assets = [] } = useQuery({
    queryKey: ["fixed-assets"],
    queryFn: () =>
      apiGet<FixedAssetSummary[]>(`/fixed-assets?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // 계정과목 (자산 계정: 13xxx)
  const { data: allAccounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () =>
      apiGet<AccountOption[]>(`/accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const assetAccounts = allAccounts.filter((a) => a.code.startsWith("13") && !a.code.startsWith("136"));
  const depExpenseAccounts = allAccounts.filter((a) => a.code === "50900");
  const accumDepAccounts = allAccounts.filter((a) => a.code === "13600");

  // 자산 상세
  const { data: detail } = useQuery({
    queryKey: ["fixed-asset-detail", selectedId],
    queryFn: () =>
      apiGet<FixedAssetDetail>(`/fixed-assets/${selectedId}`),
    enabled: !!selectedId,
  });

  // 감가상각 스케줄
  const { data: schedule } = useQuery({
    queryKey: ["fixed-asset-schedule", selectedId],
    queryFn: () =>
      apiGet<ScheduleData>(`/fixed-assets/${selectedId}/schedule`),
    enabled: !!selectedId && showSchedule,
  });

  // 등록
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost("/fixed-assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      resetForm();
      setView("list");
    },
  });

  // 감가상각 실행
  const depMutation = useMutation({
    mutationFn: (data: { tenantId: string; year: number; month: number }) =>
      apiPost<DepResult>("/fixed-assets/depreciation", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-schedule"] });
    },
  });

  // 처분
  const disposeMutation = useMutation({
    mutationFn: (data: { disposalDate: string; disposalAmount: number }) =>
      apiPost(`/fixed-assets/${selectedId}/dispose`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-asset-detail"] });
      setShowDispose(false);
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormAssetAccountId("");
    setFormDepAccountId("");
    setFormAccumAccountId("");
    setFormDate("");
    setFormCost("");
    setFormLifeMonths("");
    setFormResidual("0");
    setFormMethod("STRAIGHT_LINE");
  };

  const handleCreate = () => {
    if (!formName || !formAssetAccountId || !formDepAccountId || !formAccumAccountId || !formDate || !formCost || !formLifeMonths) return;
    createMutation.mutate({
      tenantId,
      name: formName,
      description: formDesc || undefined,
      assetAccountId: formAssetAccountId,
      depreciationAccountId: formDepAccountId,
      accumulatedDepAccountId: formAccumAccountId,
      acquisitionDate: formDate,
      acquisitionCost: Number(formCost),
      usefulLifeMonths: Number(formLifeMonths),
      residualValue: Number(formResidual) || 0,
      depreciationMethod: formMethod,
    });
  };

  const handleRunDep = () => {
    if (!tenantId) return;
    depMutation.mutate({ tenantId, year: depYear, month: depMonth });
  };

  const handleDispose = () => {
    if (!disposeDate || !disposeAmount) return;
    disposeMutation.mutate({
      disposalDate: disposeDate,
      disposalAmount: Number(disposeAmount),
    });
  };

  // 요약 계산
  const totalAssets = assets.length;
  const totalCost = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalAccDep = assets.reduce((s, a) => s + a.accumulatedDep, 0);
  const totalBookValue = assets.reduce((s, a) => s + a.bookValue, 0);

  // 엑셀 내보내기
  const exportAssets = () => {
    exportToXlsx(
      "고정자산목록",
      "자산목록",
      ["자산명", "계정", "취득일", "취득원가", "상각방법", "감가상각누계", "장부가액", "상태"],
      assets.map((a) => [
        a.name,
        `${a.assetAccountCode} ${a.assetAccountName}`,
        new Date(a.acquisitionDate).toLocaleDateString("ko-KR"),
        a.acquisitionCost,
        METHOD_LABEL[a.depreciationMethod] || a.depreciationMethod,
        a.accumulatedDep,
        a.bookValue,
        STATUS_LABEL[a.status] || a.status,
      ]),
    );
  };

  const exportScheduleXlsx = () => {
    if (!schedule) return;
    exportToXlsx(
      `감가상각스케줄_${schedule.assetName}`,
      "스케줄",
      ["기간", "감가상각액", "누적상각액", "장부가액", "구분"],
      schedule.schedule.map((r) => [
        r.period,
        r.amount,
        r.accumulatedAmount,
        r.bookValue,
        r.isActual ? "실적" : "예상",
      ]),
    );
  };

  // 자동 계정 선택 (편의)
  const autoSelectAccounts = () => {
    if (depExpenseAccounts.length > 0 && !formDepAccountId) {
      setFormDepAccountId(depExpenseAccounts[0].id);
    }
    if (accumDepAccounts.length > 0 && !formAccumAccountId) {
      setFormAccumAccountId(accumDepAccounts[0].id);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>고정자산 관리</h1>
      <p className={styles.subtitle}>
        고정자산 등록, 감가상각 자동 계산 및 내용연수를 관리하세요
      </p>

      <FixedAssetTable
        assets={assets}
        canEdit={canEdit}
        canDelete={canDelete}
        onAssetClick={(id) => {
          setSelectedId(id);
          setShowSchedule(false);
          setShowDispose(false);
          setView("detail");
        }}
        onRegisterClick={() => {
          autoSelectAccounts();
          setView("form");
        }}
        onExportAssets={exportAssets}
        depYear={depYear}
        setDepYear={setDepYear}
        depMonth={depMonth}
        setDepMonth={setDepMonth}
        onRunDep={handleRunDep}
        depIsPending={depMutation.isPending}
        depResult={depMutation.data}
        view={view}
        detail={detail}
        onBackToList={() => {
          setSelectedId(null);
          setView("list");
        }}
        showDispose={showDispose}
        setShowDispose={setShowDispose}
        disposeDate={disposeDate}
        setDisposeDate={setDisposeDate}
        disposeAmount={disposeAmount}
        setDisposeAmount={setDisposeAmount}
        onDispose={handleDispose}
        disposeIsPending={disposeMutation.isPending}
        showSchedule={showSchedule}
        setShowSchedule={setShowSchedule}
        schedule={schedule}
        onExportSchedule={exportScheduleXlsx}
        totalAssets={totalAssets}
        totalCost={totalCost}
        totalAccDep={totalAccDep}
        totalBookValue={totalBookValue}
      />

      {view === "form" && (
        <FixedAssetForm
          formName={formName}
          setFormName={setFormName}
          formDesc={formDesc}
          setFormDesc={setFormDesc}
          formAssetAccountId={formAssetAccountId}
          setFormAssetAccountId={setFormAssetAccountId}
          formDepAccountId={formDepAccountId}
          setFormDepAccountId={setFormDepAccountId}
          formAccumAccountId={formAccumAccountId}
          setFormAccumAccountId={setFormAccumAccountId}
          formDate={formDate}
          setFormDate={setFormDate}
          formCost={formCost}
          setFormCost={setFormCost}
          formLifeMonths={formLifeMonths}
          setFormLifeMonths={setFormLifeMonths}
          formResidual={formResidual}
          setFormResidual={setFormResidual}
          formMethod={formMethod}
          setFormMethod={setFormMethod}
          assetAccounts={assetAccounts}
          depExpenseAccounts={depExpenseAccounts}
          accumDepAccounts={accumDepAccounts}
          isPending={createMutation.isPending}
          onSubmit={handleCreate}
          onCancel={() => {
            resetForm();
            setView("list");
          }}
        />
      )}
    </div>
  );
}
