import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Simulates sending a WhatsApp OTP.
 * In production replace the console.log with a real Twilio / 360Dialog call.
 * The test code is always 1234.
 */
export const sendOtp = action({
  args: { phone: v.string() },
  handler: async (_ctx, { phone }) => {
    console.log("📱 [OTP] שולח קוד אימות ל:", phone);
    console.log("   ➜ קוד הבדיקה (test): 1234");
    return { sent: true };
  },
});
