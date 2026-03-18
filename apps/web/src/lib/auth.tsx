"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "./api";

interface Membership {
  tenantId: string;
  tenantName: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  memberships: Membership[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  role: string | null;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 첫 번째 소속 테넌트
  const tenantId = user?.memberships?.[0]?.tenantId ?? null;
  const role = user?.memberships?.[0]?.role ?? null;
  const canEdit = role === "ADMIN" || role === "ACCOUNTANT";
  const canDelete = role === "ADMIN";
  const isAdmin = role === "ADMIN";

  // 토큰으로 유저 정보 조회
  const fetchMe = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data);
      setToken(t);
    } catch {
      // 토큰 만료 또는 유효하지 않음
      localStorage.removeItem("token");
      setUser(null);
      setToken(null);
    }
  }, []);

  // 초기 로드: localStorage에서 토큰 확인
  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      fetchMe(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "로그인에 실패했습니다");
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    router.push("/dashboard");
  };

  const signup = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "회원가입에 실패했습니다");
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  const refreshUser = useCallback(async () => {
    if (token) await fetchMe(token);
  }, [token, fetchMe]);

  return (
    <AuthContext.Provider
      value={{ user, token, tenantId, role, canEdit, canDelete, isAdmin, loading, login, signup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
