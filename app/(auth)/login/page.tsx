"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GoogleButton from "@/components/auth/GoogleButton";
import LoginForm from "@/components/auth/LoginForm";

function LoginContent() {
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const reset = searchParams.get("reset");

  return (
    <div className="auth-card">
      <h2>Welcome Back</h2>
      <p>Sign in to continue your SAT prep journey</p>

      {registered && (
        <div className="auth-alert success">
          Account created successfully! Please sign in.
        </div>
      )}

      {reset && (
        <div className="auth-alert success">
          Password reset successfully! Please sign in with your new password.
        </div>
      )}

      <GoogleButton />

      <div className="auth-divider">
        <span>or continue with email</span>
      </div>

      <LoginForm />

      <div className="auth-footer">
        <p>
          <a href="/forgot-password">Forgot password?</a>
        </p>
        <p>
          Don&apos;t have an account? <a href="/register">Sign up</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-card">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
