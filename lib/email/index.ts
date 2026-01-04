import { getResend, fromEmail } from "./resend";
import { PasswordResetEmail } from "./templates/PasswordResetEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";

const baseUrl = process.env.AUTH_URL || "http://localhost:3000";

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  userName?: string
) {
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your SAT Buddy password",
      react: PasswordResetEmail({ resetLink, userName }),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail(email: string, userName?: string) {
  const loginUrl = `${baseUrl}/login`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Welcome to SAT Buddy!",
      react: WelcomeEmail({ userName, loginUrl }),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error };
  }
}
