import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="auth-card">
      <h2>Reset Password</h2>
      <p>Enter your email and we&apos;ll send you a reset link</p>

      <ForgotPasswordForm />

      <div className="auth-footer">
        <p>
          Remember your password? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
