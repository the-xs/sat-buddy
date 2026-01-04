import GoogleButton from "@/components/auth/GoogleButton";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="auth-card">
      <h2>Create Account</h2>
      <p>Start your SAT prep journey today</p>

      <GoogleButton />

      <div className="auth-divider">
        <span>or register with email</span>
      </div>

      <RegisterForm />

      <div className="auth-footer">
        <p>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
