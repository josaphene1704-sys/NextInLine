import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

type AppointmentDetails = {
  appt: Doc<"appointments">;
  barber: Doc<"barbers"> | null;
  service: Doc<"services"> | null;
  business: Doc<"businesses"> | null;
} | null;

// ─── Internal action: format and (simulate) send the WhatsApp confirmation ────

export const sendConfirmation = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }): Promise<{ message: string; isTest: boolean } | null> => {
    // Query lives in appointments.ts to avoid a same-file circularity.
    const data: AppointmentDetails = await ctx.runQuery(
      internal.appointments.getAppointmentDetails,
      { appointmentId }
    );

    if (!data?.appt || !data.service || !data.business) {
      console.warn("[WhatsApp] Could not load appointment data — skipping.");
      return null;
    }

    const { appt, service, business } = data;
    const timezone = business.timezone ?? "Asia/Jerusalem";

    const dateStr = new Date(appt.startTime).toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    });

    const timeStr = new Date(appt.startTime).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });

    const message: string =
      `היי ${appt.customerName}! ` +
      `התור שלך ל${service.name.he} נקבע בהצלחה לתאריך ${dateStr} בשעה ${timeStr} ` +
      `ב${business.name.he}. נשמח לראותך! 💖`;

    const isTest = appt.customerPhone === "1234";

    if (isTest) {
      console.log("📱 [WhatsApp TEST MODE]");
      console.log("   ➜ מספר:", appt.customerPhone);
      console.log("   ➜ הודעה:", message);
    } else {
      console.log("📱 [WhatsApp SIMULATED — חבר ספק כדי לשלוח באמת]");
      console.log("   ➜ מספר:", appt.customerPhone);
      console.log("   ➜ הודעה:", message);
      // TODO: replace with a real provider call, e.g.:
      // await fetch("https://api.twilio.com/...", { method: "POST", ... });
    }

    return { message, isTest };
  },
});
