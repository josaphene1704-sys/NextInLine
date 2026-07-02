"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Clock, CheckCircle2, Loader2 } from "lucide-react";

type TimePreference = "morning" | "evening" | "any";

interface Props {
  businessId:  Id<"businesses">;
  serviceId?:  Id<"services">;
  date:        string; // "YYYY-MM-DD"
  onClose:     () => void;
  onSuccess:   () => void;
}

const labels = {
  title:            { he: "הצטרפות לרשימת המתנה",       ar: "الانضمام إلى قائمة الانتظار" },
  subtitle:         { he: "נעדכן אותך ברגע שיפתח מקום", ar: "سنُعلمك فور توفر موعد" },
  name:             { he: "שם מלא",                      ar: "الاسم الكامل" },
  namePlaceholder:  { he: "שם מלא",                      ar: "الاسم الكامل" },
  phone:            { he: "מספר טלפון",                  ar: "رقم الهاتف" },
  phonePlaceholder: { he: "05X-XXXXXXX",                 ar: "05X-XXXXXXX" },
  timeLabel:        { he: "טווח שעות מועדף",             ar: "النطاق الزمني المفضل" },
  morning:          { he: "בוקר (עד 13:00)",             ar: "صباح (حتى 13:00)" },
  evening:          { he: "אחה\"צ / ערב (אחרי 13:00)",  ar: "بعد الظهر / مساء (بعد 13:00)" },
  any:              { he: "כל היום",                     ar: "طوال اليوم" },
  notes:            { he: "הערות (אופציונלי)",           ar: "ملاحظات (اختياري)" },
  notesPlaceholder: { he: "מידע נוסף...",                ar: "معلومات إضافية..." },
  submit:           { he: "הצטרף לרשימה",               ar: "انضم إلى القائمة" },
  cancel:           { he: "ביטול",                       ar: "إلغاء" },
  successTitle:     { he: "נרשמת בהצלחה!",              ar: "تم التسجيل بنجاح!" },
  successBody:      { he: "נשלח לך הודעה ברגע שיפתח תור פנוי ביום זה.",
                      ar: "سنرسل لك رسالة فور توفر موعد في هذا اليوم." },
  successClose:     { he: "סגור",                        ar: "إغلاق" },
  errorRequired:    { he: "יש למלא שם וטלפון",          ar: "الرجاء ملء الاسم والهاتف" },
};

export function WaitingListModal({ businessId, serviceId, date, onClose, onSuccess }: Props) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const join = useMutation(api.waitingList.joinWaitingList);

  const [name,       setName]       = useState("");
  const [phone,      setPhone]      = useState("");

  useEffect(() => {
    if (!user) return;
    setName((prev)  => prev  || user.name);
    setPhone((prev) => prev || user.phone);
  }, [user]);
  const [timePref,   setTimePref]   = useState<TimePreference>("any");
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [succeeded,  setSucceeded]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError(t(labels.errorRequired));
      return;
    }

    setLoading(true);
    try {
      await join({
        businessId,
        serviceId,
        date,
        timePreference: timePref,
        customerName:   name.trim(),
        customerPhone:  phone.trim(),
        notes:          notes.trim() || undefined,
      });
      setSucceeded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  const [d_year, d_month, d_day] = date.split("-").map(Number);
  const dateLabel = new Date(Date.UTC(d_year, d_month - 1, d_day)).toLocaleDateString(
    lang === "ar" ? "ar-IL" : "he-IL",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-background shadow-xl border border-border animate-float-up">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">{t(labels.title)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full w-7 h-7 flex items-center justify-center hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {succeeded ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-lg">{t(labels.successTitle)}</p>
              <p className="text-sm text-muted-foreground mt-1">{t(labels.successBody)}</p>
            </div>
            <Button
              onClick={() => { onSuccess(); onClose(); }}
              className="w-full"
            >
              {t(labels.successClose)}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">{t(labels.subtitle)}</p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t(labels.name)}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(labels.namePlaceholder)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t(labels.phone)}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t(labels.phonePlaceholder)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
                dir="ltr"
              />
            </div>

            {/* Time preference */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t(labels.timeLabel)}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["morning", "evening", "any"] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setTimePref(pref)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      timePref === pref
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/60 text-muted-foreground"
                    }`}
                  >
                    {t(labels[pref])}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t(labels.notes)}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(labels.notesPlaceholder)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                {t(labels.cancel)}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t(labels.submit)}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
