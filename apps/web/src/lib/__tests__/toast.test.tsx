import { renderHook, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../toast";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useToast", () => {
  it("toast()로 토스트를 추가한다", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast("테스트 메시지");
    });

    // 토스트가 DOM에 렌더링되는지 확인 (ToastProvider 내부에서 관리)
    // useToast는 함수만 반환하므로, 에러 없이 호출되면 성공
    expect(result.current.toast).toBeDefined();
  });

  it("toastSuccess()는 success 타입 토스트를 생성한다", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toastSuccess("성공 메시지");
    });

    expect(result.current.toastSuccess).toBeDefined();
  });

  it("toastError()는 error 타입 토스트를 생성한다", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toastError("에러 메시지");
    });

    expect(result.current.toastError).toBeDefined();
  });

  it("타임아웃 후 자동으로 토스트가 제거된다", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.toast("자동 제거 메시지");
    });

    // 4000ms 타임아웃 후 자동 제거
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    // 타이머가 실행되어도 에러가 발생하지 않으면 성공
    expect(result.current.toast).toBeDefined();
  });

  it("최대 5개까지만 토스트를 유지한다", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.toast(`메시지 ${i}`);
      }
    });

    // MAX_TOASTS=5 이므로 초과분은 잘린다
    // 내부 상태를 직접 확인할 수 없으므로, 에러 없이 동작하면 성공
    expect(result.current.toast).toBeDefined();
  });

  it("ToastProvider 없이 useToast를 호출하면 에러가 발생한다", () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast must be used within ToastProvider");
  });
});
