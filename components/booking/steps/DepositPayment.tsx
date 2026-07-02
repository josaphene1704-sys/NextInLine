"use client";
import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/utils";
import { calcFinalPrice, HairDetailsData } from "@/lib/hair-details";
import { Button } from "@/components/ui/button";
import { ChevronRight, CreditCard, AlertCircle } from "lucide-react";

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface Props {
  service: Doc<"services">;
  date: string;
  slot: TimeSlot;
  customerName: string;
  customerPhone: string;
  notes: string;
  hairDetails: HairDetailsData;
  onSuccess: (appointmentId: Id<"appointments">) => void;
  onBack: () => void;
}

export default function DepositPayment({
  service, date, slot,
  customerName, customerPhone, notes, hairDetails,
  onSuccess, onBack,
}: Props) {
  const { lang, t } = useLang();
  const [gatewayNotice, setGatewayNotice] = useState(false);

  // depositAmount and finalPrice are both in agorot — same unit as all other prices
  const depositAmount = service.depositAmount ?? 0;
  const finalPrice = calcFinalPrice(service, hairDetails.hairLength);
  const remaining = Math.max(0, finalPrice - depositAmount);

  const locale = lang === "ar" ? "ar-IL" : "he-IL";
  const [y, m, d] = date.split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  function handlePayAndBook() {
    // TODO: חבר חברת סליקה (Tranzila / PayPlus / Cardcom וכו׳).
    // לאחר קבלת אישור תשלום מחברת הסליקה, קרא ל-createAppointment ואז ל-onSuccess.
    setGatewayNotice(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-7">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">אישור הזמנה ותשלום מקדמה</h2>
        <p className="text-muted-foreground mt-1.5 text-sm max-w-xs mx-auto leading-relaxed">
          כדי לשריין את התור, יש להשלים תחילה את תשלום המקדמה.
        </p>
      </div>

      {/* Booking summary */}
      <div className="glass-panel mb-5 bg-primary/[0.03] border-primary/20 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {lang === "ar" ? "ملخص الحجز" : "סיכום ההזמנה"}
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{lang === "ar" ? "الخدمة" : "שירות"}</span>
            <span className="font-medium text-end">{t(service.name)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{lang === "ar" ? "التاريخ" : "תאריך"}</span>
            <span className="font-medium text-end">{dateDisplay}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{lang === "ar" ? "الوقت" : "שעה"}</span>
            <span className="font-medium">{slot.label}</span>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2 mt-1">
            <span className="text-muted-foreground">{lang === "ar" ? "السعر الكامل" : "מחיר מלא"}</span>
            <span className="font-bold text-primary text-base">{formatPrice(finalPrice)}</span>
          </div>
        </div>
      </div>

      {/* Deposit block — amount comes directly from service.depositAmount */}
      <div className="rounded-2xl border border-amber-400/40 bg-amber-500/8 px-5 py-5 mb-5 text-center space-y-1">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          {lang === "ar" ? "مبلغ الدفعة المقدمة" : "סכום המקדמה לתשלום עכשיו"}
        </p>
        <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
          {formatPrice(depositAmount)}
        </p>
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            {lang === "ar"
              ? `الرصيد المتبقي (${formatPrice(remaining)}) يُدفع في الصالون`
              : `היתרה (${formatPrice(remaining)}) תשולם בסלון ביום הטיפול`}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handlePayAndBook}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold py-3.5 px-5 transition-colors shadow-md shadow-amber-500/25"
          data-deposit-amount={depositAmount}
        >
          <CreditCard className="w-4 h-4" />
          {lang === "ar"
            ? `ادفع ${formatPrice(depositAmount)} وأكّد الحجز`
            : `שלם ${formatPrice(depositAmount)} ואשר הזמנה`}
        </button>

        {gatewayNotice && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-400/40 bg-blue-500/8 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {lang === "ar"
                ? "لإتمام الدفع، يجب توصيل شركة معالجة دفع (Tranzila / PayPlus / Cardcom). تواصل مع مزود الخدمة لإعداد بوابة الدفع."
                : "לביצוע תשלום יש לחבר חברת סליקה (Tranzila / PayPlus / Cardcom וכו׳). פנה לספק סליקה לצורך הגדרת שער התשלום."}
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onBack}
          className="w-full gap-1 text-muted-foreground"
        >
          <ChevronRight className="w-4 h-4" />
          {lang === "ar" ? "عودة لتعديل البيانات" : "חזור ועדכן פרטים"}
        </Button>
      </div>
    </div>
  );
}
