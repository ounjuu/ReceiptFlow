import { useState, useCallback, useEffect, useRef } from "react";
import { apiGet } from "@/lib/api";
import { Vendor, LineInput } from "../types";

// 거래처 자동완성 훅
export function useVendorAutocomplete(
  tenantId: string | null,
  lines: LineInput[],
  setLines: React.Dispatch<React.SetStateAction<LineInput[]>>,
  updateLine: (index: number, field: keyof LineInput, value: string) => void,
) {
  const [lineSuggestions, setLineSuggestions] = useState<Record<number, Vendor[]>>({});
  const [showLineSuggestions, setShowLineSuggestions] = useState<Record<number, boolean>>({});
  const linesSuggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (linesSuggestRef.current && !linesSuggestRef.current.contains(e.target as Node)) {
        setShowLineSuggestions({});
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchAutocomplete = useCallback(async (query: string): Promise<Vendor[]> => {
    if (!query.trim() || !tenantId) return [];
    try {
      return await apiGet<Vendor[]>(`/vendors/autocomplete?tenantId=${tenantId}&q=${encodeURIComponent(query.trim())}`);
    } catch {
      return [];
    }
  }, [tenantId]);

  const handleBizNoInput = useCallback(async (index: number, value: string) => {
    updateLine(index, "vendorBizNo", value);
    if (value.trim().length >= 1) {
      const results = await searchAutocomplete(value);
      setLineSuggestions((prev) => ({ ...prev, [index]: results }));
      setShowLineSuggestions((prev) => ({ ...prev, [index]: results.length > 0 }));
    } else {
      setLineSuggestions((prev) => ({ ...prev, [index]: [] }));
      setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
    }
  }, [updateLine, searchAutocomplete]);

  const selectLineVendor = useCallback((index: number, vendor: Vendor) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, vendorBizNo: vendor.bizNo || "", vendorName: vendor.name, vendorId: vendor.id }
          : l,
      ),
    );
    setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
  }, [setLines]);

  const handleBizNoBlur = useCallback(async (index: number) => {
    setTimeout(async () => {
      const bizNo = lines[index]?.vendorBizNo;
      if (!bizNo?.trim() || lines[index]?.vendorId) return;
      try {
        const vendor = await apiGet<Vendor | null>(`/vendors/search?tenantId=${tenantId}&bizNo=${encodeURIComponent(bizNo.trim())}`);
        if (vendor) {
          setLines((prev) =>
            prev.map((l, i) =>
              i === index
                ? { ...l, vendorId: vendor.id, vendorName: vendor.name }
                : l,
            ),
          );
        }
      } catch { /* ignore */ }
      setShowLineSuggestions((prev) => ({ ...prev, [index]: false }));
    }, 200);
  }, [lines, tenantId, setLines]);

  return {
    lineSuggestions, showLineSuggestions, setShowLineSuggestions, linesSuggestRef,
    handleBizNoInput, selectLineVendor, handleBizNoBlur,
  };
}

// 적요 코드 자동완성 훅
export function useSummaryAutocomplete(
  tenantId: string | null,
  journalType: string,
  setDescription: (v: string) => void,
) {
  const [summarySuggestions, setSummarySuggestions] = useState<{ id: string; code: string; description: string }[]>([]);
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (summaryRef.current && !summaryRef.current.contains(e.target as Node)) {
        setShowSummaryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDescriptionInput = useCallback(async (value: string) => {
    setDescription(value);
    if (value.trim().length >= 1 && tenantId) {
      try {
        const results = await apiGet<{ id: string; code: string; description: string }[]>(
          `/summary-codes/search?tenantId=${tenantId}&q=${encodeURIComponent(value.trim())}${journalType ? `&category=${journalType}` : ""}`,
        );
        setSummarySuggestions(results);
        setShowSummaryDropdown(results.length > 0);
      } catch {
        setSummarySuggestions([]);
        setShowSummaryDropdown(false);
      }
    } else {
      setSummarySuggestions([]);
      setShowSummaryDropdown(false);
    }
  }, [tenantId, journalType, setDescription]);

  const selectSummary = useCallback((item: { code: string; description: string }) => {
    setDescription(item.description);
    setShowSummaryDropdown(false);
  }, [setDescription]);

  return {
    summarySuggestions, showSummaryDropdown, summaryRef,
    handleDescriptionInput, selectSummary,
  };
}
