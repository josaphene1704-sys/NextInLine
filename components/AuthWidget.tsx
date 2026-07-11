"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useParams } from "next/navigation";
import { X, UserCircle2, Loader2, MessageCircle, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "login" | "register";
type Step = "phone" | "otp" | "name";

// ─── Copy ─────────────────────────────────────────────────────────────────────

const copy = {
  login:    { title: { he: "ברוכה הבאה!",    ar: "مرحباً بعودتك!" } },
  register: { title: { he: "הצטרפי אלינו",   ar: "انضمي إلينا" } },
} as const;

const L = {
  // header
  guest:        { he: "שלום, אורח",              ar: "مرحباً، زائر" },
  loginBtn:     { he: "כניסה",                   ar: "دخول" },
  registerBtn:  { he: "הרשמה",                   ar: "تسجيل" },
  logoutBtn:    { he: "התנתקי",                  ar: "خروج" },
  // step — phone
  phoneTitle:   { he: "מה מספר הטלפון שלך?",    ar: "ما رقم هاتفك؟" },
  phoneSub:     { he: "נשלח אליך קוד אימות בוואטסאפ", ar: "سنرسل لك رمز تحقق عبر واتساب" },
  phoneLabel:   { he: "מספר טלפון",              ar: "رقم الهاتف" },
  phonePh:      { he: "050-000-0000",             ar: "050-000-0000" },
  sendCode:     { he: "שליחת קוד",               ar: "إرسال الرمز" },
  sending:      { he: "שולח...",                  ar: "جاري الإرسال..." },
  // step — otp
  otpTitle:     { he: "אימות הוואטסאפ",          ar: "التحقق عبر واتساب" },
  otpSub:       { he: "קוד אימות נשלח למספר הוואטסאפ שלך", ar: "تم إرسال رمز التحقق إلى واتساب" },
  otpLabel:     { he: "קוד אימות",               ar: "رمز التحقق" },
  otpPh:        { he: "• • • •",                  ar: "• • • •" },
  verify:       { he: "אמת קוד",                  ar: "تحقق من الرمز" },
  verifying:    { he: "מאמת...",                  ar: "جاري التحقق..." },
  resend:       { he: "שלח קוד מחדש",            ar: "إعادة إرسال الرمز" },
  wrongCode:    { he: "קוד שגוי. נסי שוב.",      ar: "رمز خاطئ. حاولي مرة أخرى." },
  // step — name
  nameTitle:    { he: "מה שמך?",                 ar: "ما اسمك؟" },
  nameSub:      { he: "הכניסי את שמך המלא",      ar: "أدخلي اسمك الكامل" },
  nameLabel:    { he: "שם מלא",                  ar: "الاسم الكامل" },
  namePh:       { he: "שם פרטי ושם משפחה",       ar: "الاسم الأول واسم العائلة" },
  finish:       { he: "כניסה",                   ar: "دخول" },
  // shared
  back:         { he: "חזרה",                    ar: "رجوع" },
  switchLogin:  { he: "כבר יש לך חשבון?",       ar: "لديك حساب؟" },
  switchLoginCta:{ he: "כניסה",                  ar: "دخول" },
  switchReg:    { he: "עדיין אין לך חשבון?",    ar: "ليس لديك حساب؟" },
  switchRegCta: { he: "הרשמה",                   ar: "تسجيل" },
  errPhone:     { he: "נא להזין מספר טלפון",    ar: "يرجى إدخال رقم الهاتف" },
  errName:      { he: "נא להזין שם",             ar: "يرجى إدخال الاسم" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthWidget() {
  const { user, login, logout } = useAuth();
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useParams();
  const sendOtp = useAction(api.auth.sendOtp);
  const verifyOtp = useAction(api.auth.verifyOtp);

  // On a salon page, keep the profile scoped to that salon (and keep the URL
  // under /salon/<slug>); elsewhere use the global profile.
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const profileHref = slug ? `/salon/${slug}/profile` : "/profile";

  const [open, setOpen]       = useState(false);
  const [mode, setMode]       = useState<Mode>("login");
  const [step, setStep]       = useState<Step>("phone");
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Always reset to step 1 when opening the modal
  function openModal(m: Mode) {
    setMode(m);
    setStep("phone");
    setPhone("");
    setOtp("");
    setName("");
    setError(null);
    setLoading(false);
    setOpen(true);
  }

  function handleClose(v: boolean) {
    if (!v) {
      // Reset fully so next open is always step 1
      setStep("phone");
      setPhone("");
      setOtp("");
      setName("");
      setError(null);
    }
    setOpen(v);
  }

  // Step 1 — submit phone, call Convex action to log OTP
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || phone.trim().length < 4) {
      setError(t(L.errPhone));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendOtp({ phone: phone.trim() });
      setStep("otp");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 — verify OTP server-side
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { verified } = await verifyOtp({ phone: phone.trim(), code: otp.trim() });
      if (!verified) {
        setError(t(L.wrongCode));
        return;
      }
      setStep("name");
      setName("");
    } catch {
      setError(t(L.wrongCode));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp("");
    setError(null);
    setLoading(true);
    try {
      await sendOtp({ phone: phone.trim() });
    } finally {
      setLoading(false);
    }
  }

  // Step 3 — save name and complete login
  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t(L.errName)); return; }
    login(name, phone.trim());
    handleClose(false);
    setOpen(false);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderPhone() {
    return (
      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t(L.phoneLabel)}</Label>
          <Input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
            placeholder={t(L.phonePh)}
            autoComplete="tel"
            className="text-end"
            autoFocus
          />
        </div>
        {error && <ErrorMsg msg={error} />}
        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          {loading ? t(L.sending) : t(L.sendCode)}
        </Button>
        <SwitchMode mode={mode} setMode={setMode} setStep={setStep} setError={setError} t={t} />
      </form>
    );
  }

  function renderOtp() {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        {/* Phone reminder */}
        <p className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl py-2 px-3 font-mono" dir="ltr">
          {phone}
        </p>
        <div className="space-y-1.5">
          <Label>{t(L.otpLabel)}</Label>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            dir="ltr"
            value={otp}
            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(null); }}
            placeholder={t(L.otpPh)}
            autoComplete="one-time-code"
            className="text-center text-2xl tracking-[0.5em] font-bold"
            autoFocus
          />
        </div>
        {error && <ErrorMsg msg={error} />}
        <Button type="submit" className="w-full" disabled={otp.length < 4 || loading}>
          {loading ? t(L.verifying) : t(L.verify)}
        </Button>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <button type="button" onClick={() => { setStep("phone"); setError(null); }}
            className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
            {t(L.back)}
          </button>
          <button type="button" onClick={handleResend} disabled={loading}
            className="text-primary hover:underline disabled:opacity-50 transition-colors">
            {loading ? t(L.sending) : t(L.resend)}
          </button>
        </div>
      </form>
    );
  }

  function renderName() {
    return (
      <form onSubmit={handleNameSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t(L.nameLabel)}</Label>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder={t(L.namePh)}
            autoComplete="name"
            autoFocus
          />
        </div>
        {error && <ErrorMsg msg={error} />}
        <Button type="submit" className="w-full">
          {t(L.finish)}
        </Button>
        <button type="button"
          onClick={() => { setStep("otp"); setError(null); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
          <ChevronRight className="w-3.5 h-3.5" />
          {t(L.back)}
        </button>
      </form>
    );
  }

  const stepTitles: Record<Step, { he: string; ar: string }> = {
    phone: copy[mode].title,
    otp:   L.otpTitle,
    name:  L.nameTitle,
  };
  const stepSubs: Record<Step, { he: string; ar: string }> = {
    phone: L.phoneSub,
    otp:   L.otpSub,
    name:  L.nameSub,
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header widget */}
      {user ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => router.push(profileHref)}
            className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1.5 font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            {lang === "ar" ? user.name.split(" ")[0] : user.name.split(" ")[0]}
          </button>
          <button onClick={logout}
            className="text-xs border border-border/60 rounded-full px-3 py-1.5 font-medium hover:bg-accent transition-colors">
            {t(L.logoutBtn)}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden sm:inline">{t(L.guest)}</span>
          <button onClick={() => openModal("login")}
            className="text-xs border border-border/60 rounded-full px-3 py-1.5 font-medium hover:bg-accent transition-colors">
            {t(L.loginBtn)}
          </button>
          <button onClick={() => openModal("register")}
            className="text-xs bg-primary text-primary-foreground rounded-full px-3 py-1.5 font-medium hover:bg-primary/90 transition-colors">
            {t(L.registerBtn)}
          </button>
        </div>
      )}

      {/* Modal */}
      <Dialog.Root open={open} onOpenChange={handleClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            dir="rtl"
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card rounded-2xl shadow-xl border p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <Dialog.Close className="absolute top-4 left-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-5">
              {(["phone","otp","name"] as Step[]).map((s) => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>

            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {step === "otp"
                  ? <MessageCircle className="w-6 h-6 text-primary" />
                  : <UserCircle2 className="w-6 h-6 text-primary" />}
              </div>
            </div>

            <Dialog.Title className="text-xl font-bold text-center mb-1">
              {t(stepTitles[step])}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground text-center mb-6">
              {t(stepSubs[step])}
            </Dialog.Description>

            {step === "phone" && renderPhone()}
            {step === "otp"   && renderOtp()}
            {step === "name"  && renderName()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{msg}</p>
  );
}

function SwitchMode({ mode, setMode, setStep, setError, t }: {
  mode: Mode;
  setMode: (m: Mode) => void;
  setStep: (s: Step) => void;
  setError: (e: null) => void;
  t: (o: { he: string; ar: string }) => string;
}) {
  const isLogin = mode === "login";
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t(isLogin ? L.switchReg : L.switchLogin)}{" "}
      <button type="button"
        onClick={() => { setMode(isLogin ? "register" : "login"); setStep("phone"); setError(null); }}
        className="font-semibold text-primary hover:underline">
        {t(isLogin ? L.switchRegCta : L.switchLoginCta)}
      </button>
    </p>
  );
}
