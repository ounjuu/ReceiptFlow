import { apiGet, apiPost, API_BASE } from "../api";

// localStorage 모킹
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

const fetchMock = jest.fn();
global.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  localStorageMock.clear();
});

describe("apiGet", () => {
  it("올바른 URL과 Authorization 헤더로 fetch를 호출한다", async () => {
    localStorageMock.getItem.mockReturnValueOnce("test-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: "ok" }),
    });

    const result = await apiGet("/test");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/test`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
    expect(result).toEqual({ data: "ok" });
  });
});

describe("apiPost", () => {
  it("JSON body를 포함하여 POST 요청을 보낸다", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1 }),
    });

    const result = await apiPost("/items", { name: "test" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/items`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result).toEqual({ id: 1 });
  });
});

describe("에러 처리", () => {
  it("401 에러 시 토큰을 제거하고 로그인 페이지로 리다이렉트한다", async () => {
    localStorageMock.getItem.mockReturnValueOnce("expired-token");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(apiGet("/protected")).rejects.toThrow("인증이 만료되었습니다");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
  });

  it("403 에러 시 권한 없음 메시지를 던진다", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    await expect(apiGet("/admin")).rejects.toThrow("접근 권한이 없습니다");
  });

  it("404 에러 시 리소스 없음 메시지를 던진다", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(apiGet("/missing")).rejects.toThrow(
      "요청한 리소스를 찾을 수 없습니다",
    );
  });

  it("500 에러 시 서버 오류 메시지를 던진다", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(apiGet("/error")).rejects.toThrow(
      "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
    );
  });

  it("네트워크 에러 시 연결 확인 메시지를 던진다", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(apiGet("/any")).rejects.toThrow(
      "네트워크 연결을 확인해주세요",
    );
  });

  it("기타 에러 시 body.message를 사용한다", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ message: "유효하지 않은 데이터입니다" }),
    });

    await expect(apiPost("/validate", {})).rejects.toThrow(
      "유효하지 않은 데이터입니다",
    );
  });
});
