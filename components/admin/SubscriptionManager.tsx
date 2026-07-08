"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAdminSession } from "@/contexts/AdminSessionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, CheckCircle2, Clock, Sparkles, Bell, CalendarDays, MessageCircle, Loader2, Settings2 } from "lucide-react";

// Maps a pricing card to the Polar product keys defined in convex/polarProducts.ts
type ProductKey = "basic" | "premium" | "extraBasic" | "extraPremium";
const PLAN_PRODUCT: Record<string, { plan: ProductKey; extra: ProductKey }> = {
  basic:    { plan: "basic",   extra: "extraBasic" },
  extended: { plan: "premium", extra: "extraPremium" },
};

const TRIAL_LENGTH_DAYS = 14;

type Plan = {
  id: string;
  title: string;
  price: number;
  description: string;
  badge?: string;
  featured?: boolean;
  features: { icon: typeof CalendarClock; label: string }[];
};

const PLANS: Plan[] = [
  {
    id: "basic",
    title: "חבילה בסיסית",
    price: 99,
    description: "מתאים לעסקים בתחילת הדרך וסלונים קטנים.",
    features: [
      { icon: CalendarDays, label: "ניהול יומן ותורים מלא" },
      { icon: CalendarClock, label: "דף תורים ייעודי ללקוחות קצה" },
      { icon: MessageCircle, label: "כולל עד 150 הודעות WhatsApp בחודש (אימותים ותזכורות)" },
      { icon: Bell, label: "אפשרות לרכישת הרחבה: 50 הודעות נוספות ב-30 ₪ בלבד במידת הצורך" },
    ],
  },
  {
    id: "extended",
    title: "חבילה מורחבת",
    price: 149,
    description: "המסלול הפופולרי ביותר לסלונים ועסקים פעילים.",
    badge: "הכי פופולרי",
    featured: true,
    features: [
      { icon: CheckCircle2, label: "כל הפיצ'רים של המסלול הבסיסי" },
      { icon: MessageCircle, label: "כולל עד 300 הודעות WhatsApp בחודש (אימותים ותזכורות)" },
      { icon: Bell, label: "אפשרות לרכישת הרחבה: 100 הודעות נוספות ב-50 ₪ בלבד במידת הצורך" },
      { icon: CalendarClock, label: "לוח שנה חכם" },
      { icon: Bell, label: "רשימת המתנה אוטומטית" },
    ],
  },
];

const STATUS_LABEL: Record<string, string> = {
  trial: "תקופת ניסיון",
  active: "מנוי פעיל",
  past_due: "תשלום בהמתנה",
  cancelled: "מנוי בוטל",
};

export function SubscriptionManager({ businessId }: { businessId: Id<"businesses"> }) {
  const { session } = useAdminSession();
  const billing = useQuery(
    api.businesses.getBillingStatus,
    session ? { token: session.token, businessId } : "skip"
  );
  const createCheckout = useAction(api.polar.createCheckout);
  const createCustomerPortal = useAction(api.polar.createCustomerPortal);
  const [pending, setPending] = useState<ProductKey | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function goToCheckout(product: ProductKey) {
    if (!session) return;
    setPending(product);
    setCheckoutError(null);
    try {
      const { url } = await createCheckout({
        token: session.token,
        businessId,
        product,
        // Return the salon owner to this same admin page after payment.
        successUrl: window.location.href,
      });
      window.location.href = url;
    } catch {
      setCheckoutError("פתיחת התשלום נכשלה. נסי שוב.");
      setPending(null);
    }
  }

  async function goToPortal() {
    if (!session) return;
    setPortalPending(true);
    setCheckoutError(null);
    try {
      const { url } = await createCustomerPortal({ token: session.token, businessId });
      window.location.href = url;
    } catch {
      setCheckoutError("פתיחת ניהול המנוי נכשלה. נסי שוב.");
      setPortalPending(false);
    }
  }

  if (!billing) {
    return <div className="text-muted-foreground text-sm">טוען פרטי מנוי...</div>;
  }

  const { status, daysRemaining, isTrialExpired } = billing;
  const isTrial = status === "trial";
  const daysElapsed = isTrial && daysRemaining !== null
    ? Math.min(TRIAL_LENGTH_DAYS, TRIAL_LENGTH_DAYS - daysRemaining)
    : 0;
  const progressPct = Math.min(100, Math.max(0, (daysElapsed / TRIAL_LENGTH_DAYS) * 100));

  return (
    <div className="space-y-4">
      {/* Trial / status card */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">{STATUS_LABEL[status] ?? status}</h2>
            </div>
            {status === "active" && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                פעיל
              </span>
            )}
          </div>

          {isTrial && daysRemaining !== null && (
            <div className="space-y-2">
              <p className={`text-sm font-medium ${isTrialExpired ? "text-destructive" : "text-foreground"}`}>
                {isTrialExpired
                  ? "תקופת הניסיון הסתיימה"
                  : `${daysRemaining} ${daysRemaining === 1 ? "יום נותר" : "ימים נותרו"} בתקופת הניסיון`}
              </p>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTrialExpired ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {daysElapsed} מתוך {TRIAL_LENGTH_DAYS} ימי ניסיון נוצלו
              </p>
            </div>
          )}

          {status === "past_due" && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              התשלום האחרון לא הושלם. נא לעדכן את אמצעי התשלום כדי להמשיך להשתמש במערכת.
            </p>
          )}

          {status === "cancelled" && (
            <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">
              המנוי בוטל. ניתן להפעיל אותו מחדש בכל עת.
            </p>
          )}

          {/* Once a Polar customer exists (any non-trial status) the owner can
              open the Polar portal to change plan, update the card, or cancel. */}
          {status !== "trial" && (
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={portalPending}
              onClick={goToPortal}
            >
              {portalPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />פותח...</>
                : <><Settings2 className="w-4 h-4" />ניהול המנוי (שינוי חבילה / ביטול / אמצעי תשלום)</>}
            </Button>
          )}
        </CardContent>
      </Card>

      {checkoutError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          {checkoutError}
        </p>
      )}

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.featured ? "border-primary shadow-md" : "border-primary/40"}`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full bg-primary text-primary-foreground shadow">
                {plan.badge}
              </span>
            )}
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{plan.title}</h3>
              </div>

              <p className="text-sm text-muted-foreground">{plan.description}</p>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">₪{plan.price}</span>
                <span className="text-sm text-muted-foreground">/ חודש</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>

              {(() => {
                const keys = PLAN_PRODUCT[plan.id];
                if (!keys) return null;
                const busy = pending !== null;
                const extraDef = keys.extra === "extraPremium"
                  ? { count: 100, price: 50 }
                  : { count: 50, price: 30 };
                return (
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      disabled={status === "active" || busy}
                      onClick={() => goToCheckout(keys.plan)}
                    >
                      {pending === keys.plan
                        ? <><Loader2 className="w-4 h-4 animate-spin" />מעבירה לתשלום...</>
                        : status === "active" ? "המנוי פעיל" : "שדרגי עכשיו"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2 text-xs"
                      disabled={busy}
                      onClick={() => goToCheckout(keys.extra)}
                    >
                      {pending === keys.extra
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />מעבירה לתשלום...</>
                        : <><MessageCircle className="w-3.5 h-3.5" />{`רכשי ${extraDef.count} הודעות נוספות · ₪${extraDef.price}`}</>}
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
