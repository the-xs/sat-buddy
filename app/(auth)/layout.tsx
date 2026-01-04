import "../globals.css";
import "./auth.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-logo">
          <div className="auth-logo-icon">S</div>
          <h1>SAT Buddy</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
