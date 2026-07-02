"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export interface AdminSession {
  businessId: Id<"businesses">;
  token: string;
}

interface AdminSessionContextValue {
  session: AdminSession | null;
  /** False until the session has been read from localStorage on the client. */
  hydrated: boolean;
  setSession: (s: AdminSession) => void;
  clearSession: () => void;
  /**
   * Re-checks the current session against the server. If it's no longer valid
   * (expired / rotated), the local session is cleared. Returns whether the
   * session is still valid.
   */
  revalidate: () => Promise<boolean>;
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
  const convex = useConvex();

  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read from localStorage only after mount — keeps the server and first client
  // render identical (no hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSessionState(raw ? (JSON.parse(raw) as AdminSession) : null);
    } catch {
      setSessionState(null);
    }
    setHydrated(true);
  }, [storageKey]);

  const setSession = useCallback((s: AdminSession) => {
    localStorage.setItem(storageKey, JSON.stringify(s));
    setSessionState(s);
  }, [storageKey]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(storageKey);
    setSessionState(null);
  }, [storageKey]);

  const revalidate = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    const ok = await convex.query(api.settings.validateSession, {
      token: session.token,
      businessId: session.businessId,
    });
    if (!ok) clearSession();
    return ok;
  }, [convex, session, clearSession]);

  return (
    <AdminSessionContext.Provider value={{ session, hydrated, setSession, clearSession, revalidate }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return ctx;
}
