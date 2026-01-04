"use client";

import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="auth-card">
      <h2>Set New Password</h2>
      <p>Enter your new password below</p>

      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>

      <div className="auth-footer">
        <p>
          <a href="/login">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
