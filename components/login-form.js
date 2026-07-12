"use client";

import { useState } from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Sign-in failed.");

      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.assign(next);
    } catch (signInError) {
      setError(signInError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="loginCard" onSubmit={submit}>
      <div className="loginMark">☹</div>
      <span className="eyebrow">PRIVATE ADMIN</span>
      <h1>Brokie OS</h1>
      <p>Sign in to manage artwork, products, Shopify, and AI generation.</p>

      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error && <div className="loginError">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <small>Authorized accounts only.</small>
    </form>
  );
}
