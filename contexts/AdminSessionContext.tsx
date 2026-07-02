"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Id } from "@/convex/_generated/dataModel";

export interface AdminSession {
  businessId: Id<"businesses">;
  token: string;
}

interface AdminSessionContextValue {
  session: AdminSession | null;
  setSession: (s: AdminSession) => void;
  clearSession: () => void;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const storageKey = `adminSession_${slug}`;

  const [session, setSessionState] = useState<AdminSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as AdminSession) : null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((s: AdminSession) => {
    localStorage.setItem(storageKey, JSON.stringify(s));
    setSessionState(s);
  }, [storageKey]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(storageKey);
    setSessionState(null);
  }, [storageKey]);

  return (
    <AdminSessionContext.Provider value={{ session, setSession, clearSession }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return ctx;
}
