"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, UserCircle2 } from "lucide-react";

type Mode = "login" | "register";

const MODAL_COPY = {
  login: {
    title:    { he: "ברוכה הבאה!",              ar: "مرحباً بعودتك!" },
    subtitle: { he: "הזיני את פרטייך להמשך",   ar: "أدخلي بياناتك للمتابعة" },
    submit:   { he: "כניסה",                     ar: "دخول" },
    switch:   { he: "עדיין אין לך חשבון?",      ar: "ليس لديك حساب؟" },
    switchCta:{ he: "הרשמה",                     ar: "سجّلي" },
  },
  register: {
    title:    { he: "הצטרפי אלינו",             ar: "انضمي إلينا" },
    subtitle: { he: "צרי חשבון חדש תוך שניות", ar: "أنشئي حساباً جديداً في ثوانٍ" },
    submit:   { he: "הרשמה",                    ar: "تسجيل" },
    switch:   { he: "כבר יש לך חשבון?",        ar: "لديك حساب؟" },
    switchCta:{ he: "כניסה",                    ar: "دخولي" },
  },
} as const;

const labels = {
  guest:       { he: "שלום, אורח",  ar: "مرحباً، زائر" },
  loginBtn:    { he: "כניסה",       ar: "دخول" },
  registerBtn: { he: "הרשמה",      ar: "تسجيل" },
  logoutBtn:   { he: "התנתקי",     ar: "خروج" },
  nameLabel:   { he: "שם מלא",     ar: "الاسم الكامل" },
  namePh:      { he: "שם פרטי ושם משפחה", ar: "الاسم الأول واسم العائلة" },
  phoneLabel:  { he: "מספר טלפון", ar: "رقم الهاتف" },
  phonePh:     { he: "050-000-0000", ar: "050-000-0000" },
  errName:     { he: "נא להזין שם", ar: "يرجى إدخال الاسم" },
  errPhone:    { he: "נא להזין מספר טלפון תקין", ar: "يرجى إدخال رقم هاتف صحيح" },
};

export default function AuthWidget() {
  const { user, login, logout } = useAuth();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openModal(m: Mode) {
    setMode(m);
    setName("");
    setPhone("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t(labels.errName)); return; }
    if (!phone.trim() || phone.trim().length < 4) { setError(t(labels.errPhone)); return; }
    login(name, phone);
    setOpen(false);
  }

  const copy = MODAL_COPY[mode];

  return (
    <>
      {/* ── Header widget ─────────────────────────────────────────── */}
      {user ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lang === "ar" ? `مرحباً، ${user.name}` : `שלום, ${user.name}`}
          </span>
          <button
            onClick={logout}
            className="text-xs border border-border/60 rounded-full px-3 py-1.5 font-medium hover:bg-accent transition-colors"
          >
            {t(labels.logoutBtn)}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {t(labels.guest)}
          </span>
          <button
            onClick={() => openModal("login")}
            className="text-xs border border-border/60 rounded-full px-3 py-1.5 font-medium hover:bg-accent transition-colors"
          >
            {t(labels.loginBtn)}
          </button>
          <button
            onClick={() => openModal("register")}
            className="text-xs bg-primary text-primary-foreground rounded-full px-3 py-1.5 font-medium hover:bg-primary/90 transition-colors"
          >
            {t(labels.registerBtn)}
          </button>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────── */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          {/* Overlay */}
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* Panel */}
          <Dialog.Content
            dir={lang === "ar" ? "rtl" : "rtl"}
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card rounded-2xl shadow-xl border p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            {/* Close button */}
            <Dialog.Close className="absolute top-4 left-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle2 className="w-6 h-6 text-primary" />
              </div>
            </div>

            <Dialog.Title className="text-xl font-bold text-center mb-1">
              {t(copy.title)}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground text-center mb-6">
              {t(copy.subtitle)}
            </Dialog.Description>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t(labels.nameLabel)}</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  placeholder={t(labels.namePh)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t(labels.phoneLabel)}</Label>
                <Input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(null); }}
                  placeholder={t(labels.phonePh)}
                  autoComplete="tel"
                  className="text-end"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full">
                {t(copy.submit)}
              </Button>
            </form>

            {/* Switch mode */}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t(copy.switch)}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                className="font-semibold text-primary hover:underline"
              >
                {t(copy.switchCta)}
              </button>
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
