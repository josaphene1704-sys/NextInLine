"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, X, Scissors, Sparkles, Wand2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceForm = {
  nameHe: string;
  nameAr: string;
  descHe: string;
  descAr: string;
  duration: number;
  // Pricing
  minPriceIls: number;       // base / min price
  maxPriceIls: number;       // 0 = not set
  shortPriceIls: number;     // 0 = not set
  mediumPriceIls: number;
  longPriceIls: number;
  depositAmountIls: number;  // 0 = no deposit required
  bufferMinutes: number;     // 0 = no buffer
  requiresHairDetails: boolean;
};

const EMPTY: ServiceForm = {
  nameHe: "",
  nameAr: "",
  descHe: "",
  descAr: "",
  duration: 30,
  minPriceIls: 0,
  maxPriceIls: 0,
  shortPriceIls: 0,
  mediumPriceIls: 0,
  longPriceIls: 0,
  depositAmountIls: 0,
  bufferMinutes: 0,
  requiresHairDetails: false,
};

function docToForm(s: Doc<"services">): ServiceForm {
  const pbl = s.pricesByLength;
  return {
    nameHe: s.name.he,
    nameAr: s.name.ar,
    descHe: s.description.he,
    descAr: s.description.ar,
    duration: s.duration,
    minPriceIls:      s.price / 100,
    maxPriceIls:      s.maxPrice      ? s.maxPrice      / 100 : 0,
    shortPriceIls:    pbl?.short      ? pbl.short       / 100 : 0,
    mediumPriceIls:   pbl?.medium     ? pbl.medium      / 100 : 0,
    longPriceIls:     pbl?.long       ? pbl.long        / 100 : 0,
    depositAmountIls: s.depositAmount ? s.depositAmount / 100 : 0,
    bufferMinutes:    s.bufferMinutes ?? 0,
    requiresHairDetails: s.requiresHairDetails ?? false,
  };
}

/** Format price range for display in the admin list. */
function priceRangeLabel(s: Doc<"services">): string {
  if (s.maxPrice && s.maxPrice > s.price) {
    return `${formatPrice(s.price)} - ${formatPrice(s.maxPrice)}`;
  }
  if (s.pricesByLength) {
    return `החל מ-${formatPrice(s.price)}`;
  }
  return formatPrice(s.price);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServicesManager({ businessId }: { businessId: Id<"businesses"> }) {
  const services      = useQuery(api.services.getAllByBusiness, { businessId });
  const create        = useMutation(api.services.create);
  const update        = useMutation(api.services.update);
  const seedDefaults  = useMutation(api.businesses.seedDefaultsIfEmpty);

  const [editing, setEditing] = useState<Id<"services"> | "new" | null>(null);
  const [form, setForm]       = useState<ServiceForm>(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      await seedDefaults({ businessId });
    } finally {
      setSeeding(false);
    }
  }

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setEditing("new");
  }

  function openEdit(s: Doc<"services">) {
    setForm(docToForm(s));
    setError(null);
    setEditing(s._id);
  }

  function pf(field: keyof ServiceForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }
  function pfNum(field: keyof ServiceForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: Number(e.target.value) }));
  }

  async function handleSubmit() {
    if (!form.nameHe.trim()) { setError("נא להזין שם שירות בעברית"); return; }
    if (form.minPriceIls < 0) { setError("המחיר לא יכול להיות שלילי"); return; }
    if (form.maxPriceIls > 0 && form.maxPriceIls < form.minPriceIls) {
      setError("מחיר מקסימום חייב להיות גבוה ממחיר מינימום");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Build pricesByLength — only include lengths that have a value set
      const pbl: { short?: number; medium?: number; long?: number } = {};
      if (form.shortPriceIls  > 0) pbl.short  = Math.round(form.shortPriceIls  * 100);
      if (form.mediumPriceIls > 0) pbl.medium = Math.round(form.mediumPriceIls * 100);
      if (form.longPriceIls   > 0) pbl.long   = Math.round(form.longPriceIls   * 100);

      const payload = {
        name:                { he: form.nameHe.trim(), ar: form.nameAr.trim() },
        description:         { he: form.descHe.trim(), ar: form.descAr.trim() },
        duration:            form.duration,
        price:               Math.round(form.minPriceIls * 100),
        maxPrice:            form.maxPriceIls > 0 ? Math.round(form.maxPriceIls * 100) : undefined,
        pricesByLength:      Object.keys(pbl).length > 0 ? pbl : undefined,
        requiresHairDetails: form.requiresHairDetails || undefined,
        depositAmount:       form.depositAmountIls > 0 ? Math.round(form.depositAmountIls * 100) : 0,
        bufferMinutes:       form.bufferMinutes > 0 ? form.bufferMinutes : undefined,
      };

      if (editing === "new") {
        await create({ businessId, ...payload });
      } else if (editing) {
        await update({ serviceId: editing, ...payload });
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Doc<"services">) {
    await update({ serviceId: s._id, isActive: !s.isActive });
  }

  if (!services) {
    return <div className="text-muted-foreground text-sm">טוען שירותים...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">{services.length} שירותים</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 ml-1" />
          שירות חדש
        </Button>
      </div>

      {services.length === 0 && (
        <div className="text-center py-10 space-y-4">
          <p className="text-sm text-muted-foreground">אין שירותים עדיין</p>
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="gap-2"
          >
            <Wand2 className="w-4 h-4" />
            {seeding ? "יוצר שירותים..." : "מלא שירותי ברירת מחדל"}
          </Button>
          <p className="text-xs text-muted-foreground/70">
            יוצר 4 שירותים סטנדרטיים וספר ראשוני — ניתן לערוך לאחר מכן
          </p>
        </div>
      )}

      {/* Service list */}
      {services.map((s) => (
        <Card key={s._id} className={cn(!s.isActive && "opacity-50")}>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{s.name.he}</div>
              <div className="text-xs text-muted-foreground">{s.name.ar}</div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>{s.duration} דק&apos;</span>
                <span className="font-medium text-foreground">{priceRangeLabel(s)}</span>
                {s.pricesByLength && (
                  <span className="flex items-center gap-0.5 text-primary/70">
                    <Scissors className="w-2.5 h-2.5" />
                    מחירים לפי אורך
                  </span>
                )}
                {s.requiresHairDetails && (
                  <span className="flex items-center gap-0.5 text-violet-600 dark:text-violet-400">
                    <Sparkles className="w-2.5 h-2.5" />
                    פרטי שיער
                  </span>
                )}
                {(s.bufferMinutes ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400">
                    מרווח: {s.bufferMinutes} דק&apos;
                  </span>
                )}
                {(s.depositAmount ?? 0) > 0 && (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    מקדמה: {formatPrice(s.depositAmount!)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={s.isActive ? "default" : "secondary"}
                className="cursor-pointer select-none text-xs"
                onClick={() => toggleActive(s)}
                title="לחץ לשינוי סטטוס"
              >
                {s.isActive ? "פעיל" : "מושבת"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit / create modal */}
      {editing && (
        <Modal
          title={editing === "new" ? "שירות חדש" : "עריכת שירות"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">

            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם — עברית">
                <Input value={form.nameHe} onChange={pf("nameHe")} />
              </Field>
              <Field label="اسم — عربي">
                <Input value={form.nameAr} onChange={pf("nameAr")} dir="rtl" />
              </Field>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="תיאור — עברית">
                <Input value={form.descHe} onChange={pf("descHe")} />
              </Field>
              <Field label="وصف — عربي">
                <Input value={form.descAr} onChange={pf("descAr")} dir="rtl" />
              </Field>
            </div>

            {/* Duration + Buffer */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="משך (דקות)">
                <Input
                  type="number"
                  value={form.duration}
                  onChange={pfNum("duration")}
                  min={5}
                  step={5}
                  dir="ltr"
                  className="text-left"
                />
              </Field>
              <Field label="מרווח אחרי השירות (דק׳)">
                <Input
                  type="number"
                  value={form.bufferMinutes}
                  onChange={pfNum("bufferMinutes")}
                  min={0}
                  step={5}
                  dir="ltr"
                  className="text-left"
                  placeholder="0 = ללא"
                />
              </Field>
            </div>
            {form.bufferMinutes > 0 && (
              <p className="text-xs text-sky-600 dark:text-sky-400 -mt-2">
                אחרי שירות זה המערכת תחסום {form.bufferMinutes} דקות נוספות לפני התור הבא
              </p>
            )}

            {/* Hair details toggle */}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, requiresHairDetails: !f.requiresHairDetails }))}
              className={cn(
                "w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-200",
                form.requiresHairDetails
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground"
              )}
            >
              <div className="text-start">
                <p className="text-sm font-semibold">
                  {form.requiresHairDetails ? "✓ " : ""}דורש פרטי שיער
                </p>
                <p className="text-xs mt-0.5 opacity-70">
                  הלקוחה תתבקש למלא אורך, מצב שיער, הבהרה, שיבה ותמונות
                </p>
              </div>
              <div className={cn(
                "w-11 h-6 rounded-full transition-colors shrink-0",
                form.requiresHairDetails ? "bg-primary" : "bg-muted-foreground/30"
              )}>
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform",
                  form.requiresHairDetails ? "translate-x-5 mr-0.5" : "translate-x-0.5"
                )} />
              </div>
            </button>

            {/* ── Pricing section ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                תמחור
              </p>

              {/* Min / Max */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="מחיר מינימום (₪)">
                  <Input
                    type="number"
                    value={form.minPriceIls}
                    onChange={pfNum("minPriceIls")}
                    min={0}
                    step={10}
                    dir="ltr"
                    className="text-left"
                  />
                </Field>
                <Field label="מחיר מקסימום (₪)">
                  <Input
                    type="number"
                    value={form.maxPriceIls}
                    onChange={pfNum("maxPriceIls")}
                    min={0}
                    step={10}
                    dir="ltr"
                    className="text-left"
                    placeholder="0 = ללא"
                  />
                </Field>
              </div>

              {/* Deposit */}
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <Field label="סכום מקדמה (₪) — 0 = ללא מקדמה">
                  <Input
                    type="number"
                    value={form.depositAmountIls}
                    onChange={pfNum("depositAmountIls")}
                    min={0}
                    step={10}
                    dir="ltr"
                    className="text-left"
                    placeholder="0"
                  />
                </Field>
                {form.depositAmountIls > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
                    הלקוחה תתבקש לשלם מקדמה של ₪{form.depositAmountIls} בסיום ההזמנה
                  </p>
                )}
              </div>

              {/* Per-length prices */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  מחיר לפי אורך שיער
                  <span className="text-muted-foreground/60">(אופציונלי — 0 = לא מוגדר)</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="שיער קצר (₪)">
                    <Input
                      type="number"
                      value={form.shortPriceIls}
                      onChange={pfNum("shortPriceIls")}
                      min={0}
                      step={10}
                      dir="ltr"
                      className="text-left"
                    />
                  </Field>
                  <Field label="שיער בינוני (₪)">
                    <Input
                      type="number"
                      value={form.mediumPriceIls}
                      onChange={pfNum("mediumPriceIls")}
                      min={0}
                      step={10}
                      dir="ltr"
                      className="text-left"
                    />
                  </Field>
                  <Field label="שיער ארוך (₪)">
                    <Input
                      type="number"
                      value={form.longPriceIls}
                      onChange={pfNum("longPriceIls")}
                      min={0}
                      step={10}
                      dir="ltr"
                      className="text-left"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? "שומר..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              ביטול
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-4" dir="rtl">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
