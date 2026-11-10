"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Goal } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "update";

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState("player");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "login" || requestedMode === "signup" || requestedMode === "forgot" || requestedMode === "update") {
      setMode(requestedMode);
    }

    const authError = new URLSearchParams(window.location.search).get("error_description");
    if (authError) setMessage(authError);

    if (requestedMode === "update" && supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) setMessage("This password reset link is invalid or expired. Request a new one below.");
      });
    }
  }, []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (nextMode !== "update") window.history.replaceState({}, "", `/login?mode=${nextMode}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase isn't configured yet. Add the environment values from .env.example and run the database migration.");
      return;
    }

    if (mode === "update" && password !== confirmPassword) {
      setMessage("Those passwords do not match. Please try again.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), role } },
        });
        if (error) throw error;
        setMessage("Account created. Check your email to confirm your address, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login?mode=update`,
        });
        if (error) throw error;
        setMessage("If an account exists for that email, a password reset link has been sent.");
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Your password has been updated. You can now sign in with the new password.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        window.history.replaceState({}, "", "/login?mode=login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong.";
      if (errorMessage.toLowerCase().includes("invalid login credentials")) {
        setMessage("Email or password is incorrect. Try again or reset your password.");
      } else if (errorMessage.toLowerCase().includes("email not confirmed")) {
        setMessage("Please confirm your email address using the link we sent you, then sign in.");
      } else {
        setMessage(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  const heading = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
    update: "Choose a new password",
  }[mode];
  const description = {
    login: "Sign in to manage your squad and match day readiness.",
    signup: "Create an account to manage your squad and match day readiness.",
    forgot: "Enter your account email and we’ll send you a password reset link.",
    update: "Choose a new password for your PlayHire account.",
  }[mode];

  return (
    <main className="auth-shell">
      <Link href="/" className="auth-brand">
        <span className="brand-icon"><Goal size={21} /></span>
        playhire<span className="brand-dot">.</span>
      </Link>
      <section className="auth-card">
        <div className="modal-kicker">YOUR TEAM, ALWAYS READY</div>
        <h1>{heading}</h1>
        <p>{description}</p>
        <form onSubmit={submit}>
          {mode === "signup" && <>
            <label>Full name<input required value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
            <label>Your role<select value={role} onChange={event => setRole(event.target.value)}><option value="player">Player</option><option value="captain">Captain</option></select></label>
          </>}
          <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>
          {(mode === "login" || mode === "signup" || mode === "update") && <label>
            {mode === "update" ? "New password" : "Password"}
            <span className="password-field">
              <input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>}
          {mode === "update" && <label>Confirm new password
            <span className="password-field">
              <input required minLength={8} type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              <button className="password-toggle" type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>}
          <button disabled={busy} className="btn btn-primary full-btn">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
          </button>
        </form>
        {mode === "login" && <div className="auth-forgot-row"><button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button></div>}
        {message && <div className="auth-message" role="status" aria-live="polite">{message}</div>}
        <div className="auth-switch">
          {mode === "login" && <>New to PlayHire? <button type="button" onClick={() => switchMode("signup")}>Create an account</button></>}
          {mode === "signup" && <>Already have an account? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
          {(mode === "forgot" || mode === "update") && <>Remembered your password? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
        </div>
        <div className="auth-foot">By continuing, you agree to use PlayHire respectfully and keep team data private.</div>
      </section>
      <Link href="/" className="auth-back">← Back to PlayHire</Link>
    </main>
  );
}
