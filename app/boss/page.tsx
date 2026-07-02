"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sparkles, Copy, CheckCheck, Plus, Loader2,
  Eye, EyeOff, ExternalLink, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SESSION_KEY = "bossSession";

interface BossSession {
  token: string;
}

function readBossSession(): BossSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as BossSession) : null;
  } catch {
    return null;
  }
}

export default function BossPage() {
  const [session, setSession] = useState<BossSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(readBossSession());
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!session) return <LoginScreen onSuccess={(s) => setSession(s)} />;
  return <BossDashboard session={session} onLogout={() => setSession(null)} />;
}

function LoginScreen({ onSuccess }: { onSuccess: (session: BossSession) => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const verify = useMutation(api.settings.verifyMasterPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await verify({ password });
      const session: BossSession = { token };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onSuccess(session);
    } catch {
      setError("סיסמה שגויה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border p-8">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center mb-1">ניהול מערכת</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">הזיני את סיסמת הניהול הראשית</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>סיסמה</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="סיסמה..."
                dir="ltr"
                className="pl-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />בודקת...</> : "כניסה"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function BossDashboard({ session, onLogout }: { session: BossSession; onLogout: () => void }) {
  const businesses = useQuery(api.businesses.getAll);
  const provision = useMutation(api.businesses.provision);
  const invalidateSession = useMutation(api.settings.invalidateSession);

  const [slug, setSlug] = useState("");
  const [nameHe, setNameHe] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ salonLink: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !nameHe) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await provision({ slug: slug.trim(), nameHe: nameHe.trim(), token: session.token });
      setResult(res);
      setSlug("");
      setNameHe("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.replace(/^Uncaught Error: /, "") : "שגיאה";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeSalons = businesses?.filter(b => !b.isTemplate) ?? [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-20 glass-header px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">ניהול מערכת NextInLine</h1>
          </div>
          <button
            onClick={() => {
              invalidateSession({ token: session.token }).catch(() => {});
              localStorage.removeItem(SESSION_KEY);
              onLogout();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            התנתקות
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* ── Create new salon ─────────────────────────────────────────────── */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            יצירת ספר חדש
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>שם הספר (עברית)</Label>
                <Input
                  value={nameHe}
                  onChange={e => { setNameHe(e.target.value); setError(null); }}
                  placeholder="לדוגמה: ספר דוד"
                />
              </div>
              <div className="space-y-1.5">
                <Label>סלאג (URL — אותיות לטיניות)</Label>
                <Input
                  value={slug}
                  onChange={e => {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                    setError(null);
                  }}
                  placeholder="saper-david"
                  dir="ltr"
                />
              </div>
            </div>
            {slug && (
              <p className="text-xs text-muted-foreground">
                הקישור יהיה:{" "}
                <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/salon/{slug}</span>
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>
            )}
            <Button type="submit" disabled={loading || !slug || !nameHe} className="gap-2">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />יוצרת...</>
                : <><Plus className="w-4 h-4" />צור ספר</>}
            </Button>
          </form>

          {result && (
            <div className="mt-5 bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">הספר נוצר בהצלחה!</p>
              <ResultRow
                label="קישור לספר:"
                value={result.salonLink}
                copyKey="link"
                copied={copied}
                onCopy={copy}
                href={result.salonLink}
              />
              <ResultRow
                label="סיסמה זמנית:"
                value={result.temporaryPassword}
                copyKey="pw"
                copied={copied}
                onCopy={copy}
              />
            </div>
          )}
        </section>

        {/* ── Salons list ──────────────────────────────────────────────────── */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4">
            ספרים פעילים ({activeSalons.length})
          </h2>
          {businesses === undefined && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="space-y-3">
            {activeSalons.map(b => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/salon/${b.slug}`;
              return (
                <div key={b._id} className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{b.name.he}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      /salon/{b.slug ?? "—"}
                    </p>
                  </div>
                  {b.slug && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copy(link, b._id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title="העתק קישור"
                      >
                        {copied === b._id
                          ? <CheckCheck className="w-4 h-4 text-green-500" />
                          : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <a
                        href={`/salon/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function ResultRow({
  label, value, copyKey, copied, onCopy, href,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <code className="flex-1 text-xs bg-muted px-2 py-1 rounded-lg truncate font-mono">{value}</code>
      <button
        onClick={() => onCopy(value, copyKey)}
        className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
      >
        {copied === copyKey
          ? <CheckCheck className="w-4 h-4 text-green-500" />
          : <Copy className="w-4 h-4 text-muted-foreground" />}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      )}
    </div>
  );
}
