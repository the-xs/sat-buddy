import { Resend } from "resend";

// Lazy initialization to avoid build-time errors when API key is not set
let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export const fromEmail =
  process.env.RESEND_FROM_EMAIL || "SAT Buddy <noreply@example.com>";
