import { renderHook, act } from "@testing-library/react";
import { usePagination } from "../usePagination";

describe("usePagination", () => {
  const data = Array.from({ length: 120 }, (_, i) => ({ id: i + 1 }));

  it("기본 페이지 사이즈 50으로 첫 페이지 반환", () => {
    const { result } = renderHook(() => usePagination(data));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.total).toBe(120);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageData).toHaveLength(50);
    expect(result.current.pageData[0].id).toBe(1);
  });

  it("커스텀 페이지 사이즈", () => {
    const { result } = renderHook(() => usePagination(data, 30));

    expect(result.current.totalPages).toBe(4);
    expect(result.current.pageData).toHaveLength(30);
  });

  it("페이지 변경", () => {
    const { result } = renderHook(() => usePagination(data));

    act(() => result.current.setPage(2));

    expect(result.current.page).toBe(2);
    expect(result.current.pageData[0].id).toBe(51);
    expect(result.current.pageData).toHaveLength(50);
  });

  it("마지막 페이지는 나머지 데이터만 반환", () => {
    const { result } = renderHook(() => usePagination(data));

    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(3);
    expect(result.current.pageData).toHaveLength(20);
    expect(result.current.pageData[0].id).toBe(101);
  });

  it("데이터가 줄어들면 page가 자동 보정", () => {
    const { result, rerender } = renderHook(
      ({ d }) => usePagination(d),
      { initialProps: { d: data } },
    );

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    // 데이터를 10건으로 줄임 → totalPages=1 → page도 1로 보정
    rerender({ d: data.slice(0, 10) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageData).toHaveLength(10);
  });

  it("빈 데이터", () => {
    const { result } = renderHook(() => usePagination([]));

    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageData).toHaveLength(0);
  });
});
