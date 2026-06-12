"use client";
import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { cn, formatPrice } from "@/lib/utils";
import { HairDetailsData } from "@/lib/hair-details";
import { Button } from "@/components/ui/button";
import { ChevronRight, Camera, X, Loader2, CheckCircle2 } from "lucide-react";
import ColorPicker from "./ColorPicker";

// ─── Option data ──────────────────────────────────────────────────────────────

const HAIR_LENGTH_OPTIONS = [
  { value: "קצר",    label: "קצר" },
  { value: "בינוני", label: "בינוני" },
  { value: "ארוך",   label: "ארוך" },
];

const HAIR_CONDITION_OPTIONS = [
  { value: "בריא",        label: "בריא" },
  { value: "יבש",         label: "יבש" },
  { value: "פגום",        label: "פגום" },
  { value: "עבר החלקה",   label: "עבר החלקה" },
];

const BLEACH_HISTORY_OPTIONS = [
  { value: "כן", label: "כן" },
  { value: "לא", label: "לא" },
];

const GRAY_HAIR_OPTIONS = [
  { value: "ללא",       label: "ללא" },
  { value: "עד 30%",    label: "עד 30%" },
  { value: "30% - 60%", label: "30% - 60%" },
  { value: "מעל 60%",   label: "מעל 60%" },
];

const KERATIN_HISTORY_OPTIONS = [
  { value: "לא עברתי",              label: "לא עברתי" },
  { value: "לפני פחות מחצי שנה",   label: "לפני פחות מחצי שנה" },
  { value: "לפני חצי שנה עד שנה",  label: "לפני חצי שנה עד שנה" },
  { value: "לפני מעל שנה",         label: "לפני מעל שנה" },
];

// Hebrew selection → English DB key mapping
const LENGTH_KEY: Record<string, "short" | "medium" | "long"> = {
  "קצר":    "short",
  "בינוני": "medium",
  "ארוך":   "long",
};

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(
  file: File,
  generateUrl: () => Promise<string>
): Promise<string> {
  const uploadUrl = await generateUrl();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("שגיאה בהעלאת התמונה");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

// ─── OptionGroup ──────────────────────────────────────────────────────────────

function OptionGroup({
  label,
  sublabel,
  options,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
              value === opt.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.04]"
                : "border-border text-foreground hover:border-primary/60 hover:bg-primary/5"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PhotoUploadSlot ──────────────────────────────────────────────────────────

function PhotoUploadSlot({
  label,
  subtitle,
  existingId,
  file,
  preview,
  onSelect,
  onClear,
  colorLabel,
  colorCode,
  onColorChange,
}: {
  label: string;
  subtitle: string;
  existingId?: string;
  file: File | null;
  preview: string | null;
  onSelect: (file: File, preview: string) => void;
  onClear: () => void;
  colorLabel: string;
  colorCode: string | undefined;
  onColorChange: (code: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    onSelect(f, URL.createObjectURL(f));
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold leading-snug">{label}</p>
        <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
      </div>

      {/* Exact-shade selection from the color catalog */}
      <ColorPicker label={colorLabel} value={colorCode} onChange={onColorChange} />

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      {preview ? (
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-sm">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : existingId ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-xl border-2 border-green-500/40 bg-green-500/5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-green-500/10 transition-colors"
        >
          <CheckCircle2 className="w-7 h-7 text-green-600" />
          <p className="text-xs text-green-700 dark:text-green-400 font-medium text-center px-2 leading-snug">
            תמונה הועלתה
            <br />
            <span className="text-muted-foreground font-normal">לחצי להחלפה</span>
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">לחצי לבחירת תמונה</span>
        </button>
      )}

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  service: Doc<"services">;
  initialData: HairDetailsData;
  onNext: (data: HairDetailsData) => void;
  onBack: () => void;
}

export default function HairDetailsStep({ service, initialData, onNext, onBack }: Props) {
  const name      = service.name.he;
  const nameLower = name.toLowerCase();

  // Log the exact DB value — helps confirm encoding when debugging
  console.log("[HairDetailsStep] service name (he):", JSON.stringify(name));

  // ── Service-type classification ───────────────────────────────────────────
  //
  // isKeratin      → טיפול קראטין (any variant)
  // isColorService → בליאז' / צבע / הייליטס / גוונים
  // isEventStyling → עיצוב לאירועים
  // (everything else falls through to showLength = true as the default)

  const isKeratin =
    name.includes("קראטין") ||
    name.includes("קירטין") ||
    name.includes("קרטין")  ||
    nameLower.includes("keratin");

  const isColorService =
    // Explicit admin flag — overrides name-based detection
    service.requiresHairDetails === true ||
    // Balayage — exact matches cover every apostrophe/geresh encoding
    name === "בליאז'"          ||  // ASCII apostrophe  '  (U+0027)
    name === "בליאז'"          ||  // right single quote '  (U+2019)
    name === "בליאז׳"          ||  // Hebrew geresh      ׳  (U+05F3)
    name.includes("בליאז")     ||  // substring: catches any trailing character
    nameLower.includes("balayage") ||
    // Other color services
    name.includes("צבע")       ||
    name.includes("הייליטס")   ||
    name.includes("גוונים");

  const isEventStyling = name.includes("אירועים");

  // ── Visibility flags ──────────────────────────────────────────────────────
  //
  // Hair length is ALWAYS shown — it is the price-lookup axis and the
  // guaranteed fallback so the screen is never blank.
  const showLength      = true;
  const showPrevKeratin = isKeratin && !service.requiresHairDetails;
  const showColorFields = isColorService;   // condition + bleach + gray hair %
  const showImages      = isColorService || isEventStyling;

  // ── State ─────────────────────────────────────────────────────────────────
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [data, setData]               = useState<HairDetailsData>(initialData);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [desiredFile, setDesiredFile] = useState<File | null>(null);
  const [desiredPreview, setDesiredPreview] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const patch = (u: Partial<HairDetailsData>) => setData((d) => ({ ...d, ...u }));

  // ── Price lookup ──────────────────────────────────────────────────────────
  const lengthKey       = data.hairLength ? LENGTH_KEY[data.hairLength] : undefined;
  const pbl             = service.pricesByLength;
  const perLengthPrice  =
    lengthKey && pbl?.[lengthKey] && pbl[lengthKey]! > 0
      ? pbl[lengthKey]!
      : undefined;
  // Fall back to the service's base price so a number always shows
  const estimatedPrice  = perLengthPrice ?? (data.hairLength ? service.price : undefined);

  // ── Upload & submit ───────────────────────────────────────────────────────
  async function handleNext() {
    setUploading(true);
    setError(null);
    try {
      const photoUpdates: Partial<HairDetailsData> = {};
      if (currentFile) {
        photoUpdates.currentHairPhotoStorageId = await uploadFile(currentFile, generateUploadUrl);
      }
      if (desiredFile) {
        photoUpdates.desiredHairPhotoStorageId = await uploadFile(desiredFile, generateUploadUrl);
      }
      onNext({ ...data, ...photoUpdates });
    } catch {
      setError("שגיאה בהעלאת התמונות. נסי שנית.");
    } finally {
      setUploading(false);
    }
  }

  // ── Build sections ────────────────────────────────────────────────────────
  //
  // Each entry in `sections` is separated by a thin <hr>.
  // Section 1 is always present (hair length).
  // Sections 2 and 3 are conditional.

  const sections: React.ReactNode[] = [];

  // ── Section 1: Hair length (always shown) ─────────────────────────────────
  sections.push(
    <div key="length" className="space-y-4">
      {showLength && (
        <OptionGroup
          label="אורך השיער הנוכחי"
          options={HAIR_LENGTH_OPTIONS}
          value={data.hairLength}
          onChange={(v) => patch({ hairLength: v })}
        />
      )}

      {/* Dynamic price — appears immediately when a length is selected */}
      {estimatedPrice !== undefined && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/8 border border-primary/15">
          <span className="text-sm text-muted-foreground">
            {perLengthPrice ? "מחיר משוער לאורך שיער זה:" : "מחיר משוער:"}
          </span>
          <span className="text-base font-bold text-primary">
            {formatPrice(estimatedPrice)}
          </span>
        </div>
      )}

      {/* Previous keratin question — keratin services only */}
      {showPrevKeratin && (
        <OptionGroup
          label="האם עברת טיפול קראטין בעבר ומתי?"
          options={KERATIN_HISTORY_OPTIONS}
          value={data.previousKeratin}
          onChange={(v) => patch({ previousKeratin: v })}
        />
      )}
    </div>
  );

  // ── Section 2: Color fields (condition + bleach history + gray hair %) ─────
  if (showColorFields) {
    sections.push(
      <div key="color" className="space-y-5">
        <OptionGroup
          label="מצב השיער הנוכחי"
          options={HAIR_CONDITION_OPTIONS}
          value={data.hairCondition}
          onChange={(v) => patch({ hairCondition: v })}
        />
        <OptionGroup
          label="האם השיער עבר הבהרה (בליצ') בעבר?"
          options={BLEACH_HISTORY_OPTIONS}
          value={data.bleachHistory}
          onChange={(v) => patch({ bleachHistory: v })}
        />
        <OptionGroup
          label="אחוז שיער שיבה"
          sublabel="כמה אחוז מהשיער שלך הוא שיבה?"
          options={GRAY_HAIR_OPTIONS}
          value={data.grayHairPercentage}
          onChange={(v) => patch({ grayHairPercentage: v })}
        />
      </div>
    );
  }

  // ── Section 3: Photo uploads ───────────────────────────────────────────────
  if (showImages) {
    sections.push(
      <div key="photos">
        <p className="text-sm font-semibold mb-0.5">תמונות עזר</p>
        <p className="text-xs text-muted-foreground mb-4">
          העלאת תמונות תעזור לנו להגיע לתוצאה המושלמת
        </p>
        <div className="grid grid-cols-2 gap-3">
          <PhotoUploadSlot
            label="תמונת מצב השיער הנוכחי"
            subtitle="שלחי תמונה של השיער שלך כרגע"
            existingId={data.currentHairPhotoStorageId}
            file={currentFile}
            preview={currentPreview}
            onSelect={(f, p) => { setCurrentFile(f); setCurrentPreview(p); }}
            onClear={() => { setCurrentFile(null); setCurrentPreview(null); }}
            colorLabel="צבע השיער הנוכחי (מהקטלוג)"
            colorCode={data.currentHairColorCode}
            onColorChange={(code) => patch({ currentHairColorCode: code })}
          />
          <PhotoUploadSlot
            label="תמונת השיער הרצוי / השראה"
            subtitle="תמונה של התוצאה שאת מחפשת"
            existingId={data.desiredHairPhotoStorageId}
            file={desiredFile}
            preview={desiredPreview}
            onSelect={(f, p) => { setDesiredFile(f); setDesiredPreview(p); }}
            onClear={() => { setDesiredFile(null); setDesiredPreview(null); }}
            colorLabel="הצבע הרצוי (מהקטלוג)"
            colorCode={data.desiredHairColorCode}
            onColorChange={(code) => patch({ desiredHairColorCode: code })}
          />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="flex justify-center mb-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">פרטי השיער</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          כמה פרטים שיעזרו לנו להכין את הטיפול המושלם עבורך
        </p>
      </div>

      {/* Sections — separated by thin dividers */}
      <div className="space-y-1">
        {sections.map((section, i) => (
          <div key={i}>
            {i > 0 && <div className="h-px bg-border my-5" />}
            {section}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-5 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-7">
        <Button
          variant="ghost"
          onClick={onBack}
          type="button"
          disabled={uploading}
          className="gap-1 shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
          חזור
        </Button>
        <Button onClick={handleNext} disabled={uploading} className="flex-1 gap-2">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              מעלה תמונות...
            </>
          ) : (
            "המשך"
          )}
        </Button>
      </div>
    </div>
  );
}
