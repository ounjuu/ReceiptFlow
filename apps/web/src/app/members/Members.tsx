"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./Members.module.css";

interface Member {
  id: string;
  role: string;
  userId: string;
  email: string;
  name: string;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "관리자" },
  { value: "ACCOUNTANT", label: "회계담당" },
  { value: "VIEWER", label: "열람자" },
];

const roleStyle = (role: string) => {
  switch (role) {
    case "ADMIN": return styles.roleAdmin;
    case "ACCOUNTANT": return styles.roleAccountant;
    case "VIEWER": return styles.roleViewer;
    default: return "";
  }
};

const roleLabel = (role: string) => {
  const found = ROLE_OPTIONS.find((r) => r.value === role);
  return found ? found.label : role;
};

export default function MembersPage() {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members", tenantId],
    queryFn: () => apiGet<Member[]>(`/auth/members?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: string; tenantId: string }) =>
      apiPost<Member>("/auth/invite", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setInviteEmail("");
      setError("");
      setSuccess(`${data.email}을(를) ${roleLabel(data.role)}로 초대했습니다`);
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess("");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch<Member>(`/auth/members/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!inviteEmail) return;
    inviteMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      tenantId: tenantId!,
    });
  };

  const handleRemove = (member: Member) => {
    if (member.userId === user?.id) {
      alert("본인은 삭제할 수 없습니다");
      return;
    }
    if (confirm(`${member.name} (${member.email})을(를) 멤버에서 제거하시겠습니까?`)) {
      removeMutation.mutate(member.id);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>멤버 관리</h1>

      <div className={styles.inviteSection}>
        <h2 className={styles.sectionTitle}>멤버 초대</h2>
        <form className={styles.inviteForm} onSubmit={handleInvite}>
          <div className={styles.field}>
            <label className={styles.label}>이메일</label>
            <input
              className={styles.input}
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>역할</label>
            <select
              className={styles.select}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className={styles.inviteBtn}
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? "초대 중..." : "초대"}
          </button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </div>

      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>멤버 목록</h2>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.name}
                  {member.userId === user?.id && " (나)"}
                </td>
                <td>{member.email}</td>
                <td>
                  {member.userId === user?.id ? (
                    <span className={`${styles.role} ${roleStyle(member.role)}`}>
                      {roleLabel(member.role)}
                    </span>
                  ) : (
                    <select
                      className={styles.roleSelect}
                      value={member.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          id: member.id,
                          role: e.target.value,
                        })
                      }
                      disabled={updateRoleMutation.isPending}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {member.userId !== user?.id && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleRemove(member)}
                    >
                      제거
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  멤버가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
