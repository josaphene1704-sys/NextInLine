"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Loader2 } from "lucide-react";

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface Props {
  service: Doc<"services">;
  barber: Doc<"barbers">;
  date: string;
  slot: TimeSlot;
  customerName: string;
  customerPhone: string;
  notes: string;
  onChange: (patch: { customerName?: string; customerPhone?: string; notes?: string }) => void;
  onSuccess: (appointmentId: Id<"appointments">) => void;
  onBack: () => void;
}

const labels = {
  title: { he: "פרטי קשר", ar: "بيانات التواصل" },
  subtitle: { he: "כמעט סיימנו! מלאי את הפרטים שלך", ar: "تقريباً انتهينا! أدخلي بياناتك" },
  summary: { he: "סיכום ההזמנה", ar: "ملخص الحجز" },
  service: { he: "שירות", ar: "الخدمة" },
  stylist: { he: "מעצבת", ar: "المصففة" },
  date: { he: "תאריך", ar: "التاريخ" },
  time: { he: "שעה", ar: "الوقت" },
  price: { he: "מחיר", ar: "السعر" },
  name: { he: "שם מלא", ar: "الاسم الكامل" },
  namePlaceholder: { he: "שם פרטי ושם משפחה", ar: "الاسم الأول واسم العائلة" },
  phone: { he: "מספר טלפון", ar: "رقم الهاتف" },
  phonePlaceholder: { he: "050-123-4567", ar: "050-123-4567" },
  notes: { he: "הערות (אופציונלי)", ar: "ملاحظات (اختياري)" },
  notesPlaceholder: { he: "העדפות מיוחדות, אלרגיות, בקשות...", ar: "تفضيلات خاصة، حساسيات، طلبات..." },
  submit: { he: "אישור הזמנה", ar: "تأكيد الحجز" },
  submitting: { he: "שולחת...", ar: "جاري الإرسال..." },
  back: { he: "חזור", ar: "رجوع" },
};

export default function ContactForm({
  service,
  barber,
  date,
  slot,
  customerName,
  customerPhone,
  notes,
  onChange,
  onSuccess,
  onBack,
}: Props) {
  const { lang, t } = useLang();
  const createAppointment = useMutation(api.appointments.createAppointment);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = lang === "ar" ? "ar-IL" : "he-IL";
  const [y, m, d] = date.split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await createAppointment({
        barberId: barber._id,
        serviceId: service._id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        startTime: slot.startTime,
        notes: notes.trim() || undefined,
      });
      onSuccess(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="text-center mb-7">
        <h2 className="text-2xl font-bold">{t(labels.title)}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t(labels.subtitle)}</p>
      </div>

      {/* Booking summary card */}
      <Card className="mb-6 bg-accent/25 border-primary/20">
        <CardContent className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t(labels.summary)}
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.service)}</span>
              <span className="font-medium text-end">{t(service.name)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.stylist)}</span>
              <span className="font-medium text-end">{t(barber.name)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.date)}</span>
              <span className="font-medium text-end">{dateDisplay}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.time)}</span>
              <span className="font-medium">{slot.label}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 mt-1">
              <span className="text-muted-foreground">{t(labels.price)}</span>
              <span className="font-bold text-primary text-base">{formatPrice(service.price)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cust-name">{t(labels.name)}</Label>
          <Input
            id="cust-name"
            value={customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
            placeholder={t(labels.namePlaceholder)}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-phone">{t(labels.phone)}</Label>
          <Input
            id="cust-phone"
            type="tel"
            dir="ltr"
            value={customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
            placeholder={t(labels.phonePlaceholder)}
            required
            autoComplete="tel"
            className="text-end"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-notes">{t(labels.notes)}</Label>
          <textarea
            id="cust-notes"
            value={notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t(labels.notesPlaceholder)}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onBack} type="button" className="gap-1 shrink-0">
            <ChevronRight className="w-4 h-4" />
            {t(labels.back)}
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1 gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? t(labels.submitting) : t(labels.submit)}
          </Button>
        </div>
      </form>
    </div>
  );
}
