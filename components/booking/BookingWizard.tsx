"use client";
import { useState, useEffect } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ServicePicker from "./steps/ServicePicker";
import BarberPicker from "./steps/BarberPicker";
import DateTimePicker from "./steps/DateTimePicker";
import ContactForm from "./steps/ContactForm";
import Confirmation from "./steps/Confirmation";
import { CheckCircle2, Scissors, Sparkles, Calendar, Phone } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

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
  appointmentId: Id<"appointments"> | null;
}

const STEPS = [
  { num: 1, Icon: Scissors, he: "שירות", ar: "خدمة" },
  { num: 2, Icon: Sparkles, he: "מעצבת", ar: "مصففة" },
  { num: 3, Icon: Calendar, he: "מועד", ar: "موعد" },
  { num: 4, Icon: Phone, he: "פרטים", ar: "بيانات" },
] as const;

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
    appointmentId: null,
  });

  // Pre-fill contact details from the logged-in user whenever they become
  // available. Only overwrites fields that are still empty so a user who has
  // already started typing isn't interrupted.
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
      customerName: "", customerPhone: "", notes: "", appointmentId: null,
    });
    setStep(1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* Progress bar */}
      {step < 5 && (
        <div className="flex items-center justify-center mb-10">
          {STEPS.map(({ num, Icon, he, ar }, idx) => {
            const done = num < step;
            const active = num === step;
            return (
              <div key={num} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      done && "bg-primary border-primary text-primary-foreground shadow-sm",
                      active && "border-primary text-primary bg-primary/8 shadow-md",
                      !done && !active && "border-border text-muted-foreground"
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
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-10 sm:w-16 h-0.5 mx-1 mb-5 transition-all duration-300",
                      num < step ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Steps */}
      {step === 1 && (
        <ServicePicker
          businessId={businessId}
          selectedId={state.service?._id}
          onSelect={(service) => {
            patch({ service, barber: null, date: null, slot: null });
            setStep(2);
          }}
        />
      )}

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

      {step === 3 && state.service && state.barber && (
        <DateTimePicker
          barberId={state.barber._id}
          serviceId={state.service._id}
          selectedDate={state.date}
          selectedSlot={state.slot}
          onSelectDate={(date) => patch({ date, slot: null })}
          onSelectSlot={(slot) => {
            patch({ slot });
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && state.service && state.barber && state.date && state.slot && (
        <ContactForm
          service={state.service}
          barber={state.barber}
          date={state.date}
          slot={state.slot}
          customerName={state.customerName}
          customerPhone={state.customerPhone}
          notes={state.notes}
          onChange={(p) => patch(p)}
          onSuccess={(appointmentId) => {
            patch({ appointmentId });
            setStep(5);
          }}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && state.slot && (
        <Confirmation
          service={state.service}
          barber={state.barber}
          date={state.date!}
          slot={state.slot}
          customerName={state.customerName}
          onReset={reset}
        />
      )}
    </div>
  );
}
