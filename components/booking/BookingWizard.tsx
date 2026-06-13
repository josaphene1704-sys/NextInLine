"use client";
import { useState, useEffect } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { HairDetailsData, needsHairDetailsStep } from "@/lib/hair-details";
import ServicePicker from "./steps/ServicePicker";
import BarberPicker from "./steps/BarberPicker";
import DateTimePicker from "./steps/DateTimePicker";
import HairDetailsStep from "./steps/HairDetailsStep";
import ContactForm from "./steps/ContactForm";
import DepositPayment from "./steps/DepositPayment";
import Confirmation from "./steps/Confirmation";
import { UpcomingAppointmentsBanner } from "@/components/booking/UpcomingAppointmentsBanner";
import { CheckCircle2, Scissors, Sparkles, Calendar, Phone, Camera } from "lucide-react";

// Step 4 = HairDetails (conditional)
// Step 5 = Contact form (no Convex write yet when deposit > 0)
// Step 6 = Deposit payment screen (only when service.depositAmount > 0)
// Step 7 = Confirmation (Convex write has already happened)
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface WizardState {
  service: Doc<"services"> | null;
  barber: Doc<"barbers"> | null;
  date: string | null;
  slot: TimeSlot | null;
  customerName: string;
  customerPhone: string;
  notes: string;
  hairDetails: HairDetailsData;
  appointmentId: Id<"appointments"> | null;
}

// ─── Progress bar definitions ─────────────────────────────────────────────────

const BASE_STEPS = [
  { num: 1, Icon: Scissors,  he: "שירות",  ar: "خدمة" },
  { num: 2, Icon: Sparkles,  he: "מעצבת",  ar: "مصففة" },
  { num: 3, Icon: Calendar,  he: "מועד",   ar: "موعد" },
  { num: 4, Icon: Phone,     he: "פרטים",  ar: "بيانات" },
] as const;

const HAIR_STEPS = [
  { num: 1, Icon: Scissors,  he: "שירות",    ar: "خدمة" },
  { num: 2, Icon: Sparkles,  he: "מעצבת",    ar: "مصففة" },
  { num: 3, Icon: Calendar,  he: "מועד",     ar: "موعد" },
  { num: 4, Icon: Camera,    he: "שיער",     ar: "شعر" },
  { num: 5, Icon: Phone,     he: "פרטים",    ar: "بيانات" },
] as const;

/**
 * Maps the actual wizard step to the progress bar indicator position.
 * When the service has a hair-details step the progress bar has 5 nodes;
 * otherwise it has 4, and ContactForm (wizard step 5) maps to node 4.
 */
function toProgressStep(step: Step, hasHair: boolean): number {
  if (step <= 3) return step;
  if (hasHair) return Math.min(step as number, 5);
  // No hair step: wizard step 5 (ContactForm) → progress node 4
  return 4;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingWizard({ businessId }: { businessId: Id<"businesses"> }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    service: null,
    barber: null,
    date: null,
    slot: null,
    customerName: "",
    customerPhone: "",
    notes: "",
    hairDetails: {},
    appointmentId: null,
  });

  useEffect(() => {
    if (!user) return;
    setState((s) => ({
      ...s,
      customerName:  s.customerName  || user.name,
      customerPhone: s.customerPhone || user.phone,
    }));
  }, [user]);

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const reset = () => {
    setState({
      service: null, barber: null, date: null, slot: null,
      customerName: "", customerPhone: "", notes: "",
      hairDetails: {}, appointmentId: null,
    });
    setStep(1);
  };

  const hasHair = needsHairDetailsStep(state.service);
  const progressSteps = hasHair ? HAIR_STEPS : BASE_STEPS;
  const progressIdx = toProgressStep(step, hasHair);
  const showProgress = step < 6;


  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 animate-float-up">
      {/* Progress bar */}
      {showProgress && (
        <div className="flex items-center justify-center mb-10">
          {progressSteps.map(({ num, Icon, he, ar }, idx) => {
            const done   = num < progressIdx;
            const active = num === progressIdx;
            return (
              <div key={num} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      done   && "step-node-done",
                      active && "step-node-active",
                      !done && !active && "step-node"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden sm:block",
                      active ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {lang === "ar" ? ar : he}
                  </span>
                </div>
                {idx < progressSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-10 sm:w-16 h-px mx-1 mb-5 rounded-full transition-all duration-500",
                      num < progressIdx
                        ? "bg-gradient-to-r from-primary/60 to-primary/80"
                        : "bg-border/60"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming appointments banner — shown at step 1 for logged-in users */}
      {step === 1 && user && (
        <UpcomingAppointmentsBanner customerPhone={user.phone} />
      )}

      {/* Step 1 — Service */}
      {step === 1 && (
        <ServicePicker
          businessId={businessId}
          selectedId={state.service?._id}
          onSelect={(service) => {
            patch({ service, barber: null, date: null, slot: null, hairDetails: {} });
            setStep(2);
          }}
        />
      )}

      {/* Step 2 — Barber */}
      {step === 2 && state.service && (
        <BarberPicker
          businessId={businessId}
          serviceId={state.service._id}
          selectedId={state.barber?._id}
          onSelect={(barber) => {
            patch({ barber, date: null, slot: null });
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {/* Step 3 — Date/Time */}
      {step === 3 && state.service && state.barber && (
        <DateTimePicker
          barberId={state.barber._id}
          serviceId={state.service._id}
          selectedDate={state.date}
          selectedSlot={state.slot}
          onSelectDate={(date) => patch({ date, slot: null })}
          onSelectSlot={(slot) => {
            patch({ slot });
            // Skip step 4 if this service doesn't need hair details
            setStep(needsHairDetailsStep(state.service) ? 4 : 5);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {/* Step 4 — Hair Details (conditional) */}
      {step === 4 && state.service && (
        <HairDetailsStep
          service={state.service}
          initialData={state.hairDetails}
          onNext={(hairDetails) => {
            patch({ hairDetails });
            setStep(5);
          }}
          onBack={() => setStep(3)}
        />
      )}

      {/* Step 5 — Contact form
          • depositAmount === 0 → createAppointment now → Step 7
          • depositAmount  > 0 → hold, go to Step 6 (payment gate) */}
      {step === 5 && state.service && state.barber && state.date && state.slot && (
        <ContactForm
          service={state.service}
          barber={state.barber}
          date={state.date}
          slot={state.slot}
          customerName={state.customerName}
          customerPhone={state.customerPhone}
          notes={state.notes}
          hairDetails={state.hairDetails}
          onChange={(p) => patch(p)}
          onSuccess={(appointmentId) => {
            patch({ appointmentId });
            setStep(7);
          }}
          onPaymentRequired={() => setStep(6)}
          onBack={() => setStep(hasHair ? 4 : 3)}
        />
      )}

      {/* Step 6 — Deposit payment
          createAppointment fires only after payment succeeds */}
      {step === 6 && state.service && state.barber && state.date && state.slot && (
        <DepositPayment
          service={state.service}
          barber={state.barber}
          date={state.date}
          slot={state.slot}
          customerName={state.customerName}
          customerPhone={state.customerPhone}
          notes={state.notes}
          hairDetails={state.hairDetails}
          onSuccess={(appointmentId) => {
            patch({ appointmentId });
            setStep(7);
          }}
          onBack={() => setStep(5)}
        />
      )}

      {/* Step 7 — Confirmation (appointment already in DB) */}
      {step === 7 && state.slot && (
        <Confirmation
          service={state.service}
          barber={state.barber}
          date={state.date!}
          slot={state.slot}
          customerName={state.customerName}
          hairDetails={state.hairDetails}
          onReset={reset}
        />
      )}
    </div>
  );
}
