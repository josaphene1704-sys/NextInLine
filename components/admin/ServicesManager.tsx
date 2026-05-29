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
import { Plus, Pencil, X } from "lucide-react";

type ServiceForm = {
  nameHe: string;
  nameAr: string;
  descHe: string;
  descAr: string;
  duration: number;
  priceIls: number;
};

const EMPTY: ServiceForm = {
  nameHe: "",
  nameAr: "",
  descHe: "",
  descAr: "",
  duration: 30,
  priceIls: 0,
};

function docToForm(s: Doc<"services">): ServiceForm {
  return {
    nameHe: s.name.he,
    nameAr: s.name.ar,
    descHe: s.description.he,
    descAr: s.description.ar,
    duration: s.duration,
    priceIls: s.price / 100,
  };
}

export function ServicesManager({ businessId }: { businessId: Id<"businesses"> }) {
  const services = useQuery(api.services.getAllByBusiness, { businessId });
  const create = useMutation(api.services.create);
  const update = useMutation(api.services.update);

  const [editing, setEditing] = useState<Id<"services"> | "new" | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setForm(EMPTY);
    setEditing("new");
  }

  function openEdit(s: Doc<"services">) {
    setForm(docToForm(s));
    setEditing(s._id);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = {
        name: { he: form.nameHe, ar: form.nameAr },
        description: { he: form.descHe, ar: form.descAr },
        duration: form.duration,
        price: Math.round(form.priceIls * 100),
      };
      if (editing === "new") {
        await create({ businessId, ...payload });
      } else if (editing) {
        await update({ serviceId: editing, ...payload });
      }
      setEditing(null);
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
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">{services.length} שירותים</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 ml-1" />
          שירות חדש
        </Button>
      </div>

      {services.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          אין שירותים עדיין
        </p>
      )}

      {services.map((s) => (
        <Card key={s._id} className={cn(!s.isActive && "opacity-50")}>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{s.name.he}</div>
              <div className="text-xs text-muted-foreground">{s.name.ar}</div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>{s.duration} דק&apos;</span>
                <span className="font-medium text-foreground">{formatPrice(s.price)}</span>
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

      {editing && (
        <Modal
          title={editing === "new" ? "שירות חדש" : "עריכת שירות"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם — עברית">
                <Input
                  value={form.nameHe}
                  onChange={(e) => setForm({ ...form, nameHe: e.target.value })}
                />
              </Field>
              <Field label="اسم — عربي">
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  dir="rtl"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="תיאור — עברית">
                <Input
                  value={form.descHe}
                  onChange={(e) => setForm({ ...form, descHe: e.target.value })}
                />
              </Field>
              <Field label="وصف — عربي">
                <Input
                  value={form.descAr}
                  onChange={(e) => setForm({ ...form, descAr: e.target.value })}
                  dir="rtl"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="משך (דקות)">
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  min={5}
                  step={5}
                  dir="ltr"
                  className="text-left"
                />
              </Field>
              <Field label="מחיר (₪)">
                <Input
                  type="number"
                  value={form.priceIls}
                  onChange={(e) => setForm({ ...form, priceIls: Number(e.target.value) })}
                  min={0}
                  step={1}
                  dir="ltr"
                  className="text-left"
                />
              </Field>
            </div>
          </div>
          <div className="flex gap-2 pt-3">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
        dir="rtl"
      >
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
