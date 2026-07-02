"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Eye, EyeOff, Check, Loader2, Power, PowerOff } from "lucide-react";
import { useAdminSession } from "@/contexts/AdminSessionContext";

// ─── Password change card ──────────────────────────────────────────────────────

function PasswordCard({ businessId }: { businessId?: Id<"businesses"> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const updatePassword = useMutation(api.settings.updateAdminPassword);
  const { setSession } = useAdminSession();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { token } = await updatePassword({ currentPassword, newPassword, businessId });
      // Rotate the local session too — the server invalidated the old token.
      if (token && businessId) setSession({ businessId, token });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "אירעה שגיאה, נסי שנית";
      setError(msg.replace(/^Uncaught Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  function handleChange() {
    setError(null);
    setSuccess(false);
  }

  return (
    <Card className="max-w-md">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <CardTitle className="text-base">שינוי סיסמת ניהול</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            עדכני את הסיסמה לכניסה לממשק הניהול
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">סיסמה נוכחית</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); handleChange(); }}
                placeholder="הזיני סיסמה נוכחית..."
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">סיסמה חדשה</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); handleChange(); }}
                placeholder="הזיני סיסמה חדשה..."
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              הסיסמה עודכנה בהצלחה!
            </p>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || !currentPassword || !newPassword}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />שומרת...</>
            ) : (
              "שמור סיסמה חדשה"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Shop activation card ──────────────────────────────────────────────────────

function ShopStatusCard({ businessId }: { businessId?: Id<"businesses"> }) {
  const businesses = useQuery(api.businesses.getAll);
  const business = businessId
    ? businesses?.find((b) => b._id === businessId)
    : businesses?.[0];
  const setIsActive = useMutation(api.businesses.setIsActive);
  const { session } = useAdminSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = business?.isActive !== false; // undefined or true = active

  async function handleToggle() {
    if (!business) return;
    setLoading(true);
    setError(null);
    try {
      await setIsActive({ businessId: business._id, isActive: !isActive, token: session?.token ?? "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "אירעה שגיאה";
      setError(msg.replace(/^Uncaught Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  if (!business) return null;

  return (
    <Card className="max-w-md">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-green-500/10" : "bg-destructive/10"}`}>
          {isActive
            ? <Power className="w-5 h-5 text-green-600 dark:text-green-400" />
            : <PowerOff className="w-5 h-5 text-destructive" />
          }
        </div>
        <div>
          <CardTitle className="text-base">סטטוס העסק</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            השהיית/הפעלת דף ההזמנות הציבורי
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${isActive ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-green-500" : "bg-destructive"}`} />
          {isActive ? "העסק פעיל — לקוחות יכולות לבצע הזמנות" : "העסק מושהה — דף ההזמנות מוסתר מהציבור"}
        </div>

        {!isActive && (
          <p className="text-xs text-muted-foreground">
            בזמן ההשהיה, דף ההזמנות הציבורי מציג הודעת &quot;העמוד אינו זמין&quot;. ניתן להפעיל מחדש בכל עת.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <Button
          variant={isActive ? "destructive" : "default"}
          className="w-full gap-2"
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />מעדכנת...</>
          ) : isActive ? (
            <><PowerOff className="w-4 h-4" />השהה את העסק</>
          ) : (
            <><Power className="w-4 h-4" />הפעל את העסק</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export function PasswordSettings({ businessId }: { businessId?: Id<"businesses"> }) {
  return (
    <div className="space-y-6">
      <PasswordCard businessId={businessId} />
      <ShopStatusCard businessId={businessId} />
    </div>
  );
}
