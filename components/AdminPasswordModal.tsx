"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff, X, Loader2, KeyRound } from "lucide-react";

interface AdminPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: Id<"businesses">;
  adminSuccessPath?: string;
  /** Called with the freshly-issued session token on successful login/activation. */
  onAuthenticated?: (token: string) => void;
}

type Phase = "login" | "force-change";

export function AdminPasswordModal({
  open,
  onOpenChange,
  businessId,
  adminSuccessPath = "/admin",
  onAuthenticated,
}: AdminPasswordModalProps) {
  const [phase, setPhase] = useState<Phase>("login");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verifyPassword = useMutation(api.settings.verifyAdminPassword);
  const activateAndSetPassword = useMutation(api.settings.activateAndSetPassword);
  const router = useRouter();

  function handleClose() {
    setPassword("");
    setNewPassword("");
    setError(null);
    setShowPassword(false);
    setShowNewPassword(false);
    setPhase("login");
    onOpenChange(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const { isFirstLogin, token } = await verifyPassword({ password, businessId });
      if (isFirstLogin) {
        setPhase("force-change");
      } else {
        if (token) onAuthenticated?.(token);
        handleClose();
        router.push(adminSuccessPath);
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "אירעה שגיאה, נסי שנית";
      const msg = raw.replace(/^Uncaught Error: /, "");
      if (msg.includes("Account suspended")) {
        setError("החשבון מושהה. פני לתמיכה.");
      } else if (msg.includes("סיסמה שגויה")) {
        setError("סיסמה שגויה, נסי שנית");
      } else {
        setError("אירעה שגיאה, נסי שנית");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForceChange(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !newPassword || newPassword.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      // Atomic: server re-verifies the temp password and sets the new one
      // in a single transaction — the client cannot skip the verification step.
      const { token } = await activateAndSetPassword({
        businessId,
        currentPassword: password, // the temp password entered in the login phase
        newPassword,
      });
      onAuthenticated?.(token);
      handleClose();
      router.push(adminSuccessPath);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "אירעה שגיאה, נסי שנית";
      setError(raw.replace(/^Uncaught Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          dir="rtl"
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card rounded-2xl shadow-xl border p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Only allow closing during login phase */}
          {phase === "login" && (
            <Dialog.Close
              onClick={handleClose}
              className="absolute top-4 left-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          )}

          {/* Icon */}
          <div className="flex justify-center mb-4 mt-2">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${phase === "force-change" ? "bg-amber-500/10" : "bg-primary/10"}`}>
              {phase === "force-change"
                ? <KeyRound className="w-7 h-7 text-amber-500" />
                : <ShieldCheck className="w-7 h-7 text-primary" />
              }
            </div>
          </div>

          {/* ── Login phase ──────────────────────────────────────────────────── */}
          {phase === "login" && (
            <>
              <Dialog.Title className="text-xl font-bold text-center mb-1">
                כניסה לניהול
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground text-center mb-6">
                הזיני את סיסמת הניהול כדי להמשיך
              </Dialog.Description>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">סיסמה</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="הזיני סיסמה..."
                      autoComplete="current-password"
                      dir="ltr"
                      className="pl-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full gap-2" disabled={loading || !password}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />בודקת...</>
                    : "כניסה לניהול"
                  }
                </Button>
              </form>
            </>
          )}

          {/* ── Force-change phase ───────────────────────────────────────────── */}
          {phase === "force-change" && (
            <>
              <Dialog.Title className="text-xl font-bold text-center mb-1">
                שינוי סיסמה נדרש
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground text-center mb-4">
                זוהי הכניסה הראשונה שלך. הגדירי סיסמה חדשה לפני שתמשיכי.
              </Dialog.Description>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 text-center mb-5">
                לא ניתן לגשת לממשק הניהול עד לשינוי הסיסמה
              </div>

              <form onSubmit={handleForceChange} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-password">סיסמה חדשה</Label>
                  <div className="relative">
                    <Input
                      id="new-admin-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                      placeholder="לפחות 6 תווים..."
                      dir="ltr"
                      className="pl-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      tabIndex={-1}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={loading || !newPassword || newPassword.length < 6}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />שומרת...</>
                    : "שמור סיסמה וכנסי"
                  }
                </Button>
              </form>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
