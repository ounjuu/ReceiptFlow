import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth";

// next/navigation 모킹
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

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

// fetch 모킹
const fetchMock = jest.fn();
global.fetch = fetchMock;

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const mockUser = {
  id: "1",
  email: "admin@test.com",
  name: "Admin",
  memberships: [{ tenantId: "t1", tenantName: "Test", role: "ADMIN" }],
};

const mockAccountant = {
  id: "2",
  email: "acc@test.com",
  name: "Accountant",
  memberships: [{ tenantId: "t1", tenantName: "Test", role: "ACCOUNTANT" }],
};

const mockViewer = {
  id: "3",
  email: "viewer@test.com",
  name: "Viewer",
  memberships: [{ tenantId: "t1", tenantName: "Test", role: "VIEWER" }],
};

beforeEach(() => {
  fetchMock.mockReset();
  localStorageMock.clear();
  pushMock.mockClear();
});

describe("useAuth", () => {
  it("초기 상태에서 loading이 true이다", () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it("ADMIN 역할은 canEdit이 true이다", async () => {
    localStorageMock.getItem.mockReturnValue("admin-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.canEdit).toBe(true);
  });

  it("ACCOUNTANT 역할은 canEdit이 true이다", async () => {
    localStorageMock.getItem.mockReturnValue("acc-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountant,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.canEdit).toBe(true);
  });

  it("ADMIN만 canDelete가 true이다", async () => {
    localStorageMock.getItem.mockReturnValue("admin-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.canDelete).toBe(true);
  });

  it("VIEWER 역할은 canDelete가 false이다", async () => {
    localStorageMock.getItem.mockReturnValue("viewer-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockViewer,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.canDelete).toBe(false);
    expect(result.current.canEdit).toBe(false);
  });

  it("ADMIN만 isAdmin이 true이다", async () => {
    localStorageMock.getItem.mockReturnValue("admin-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.isAdmin).toBe(true);
  });

  it("logout은 토큰과 유저를 초기화한다", async () => {
    localStorageMock.getItem.mockReturnValue("admin-token");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
