"use client";

import { useState } from "react";

export default function IntegrationCard({ title, description, endpoint }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function testConnection() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Connection failed");
      setState("success");
      setMessage(data.message || "Connected");
    } catch (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  return (
    <article className="integrationCard">
      <div>
        <span className={`dot ${state}`} />
        <h3>{title}</h3>
        <p>{description}</p>
        {message && <small className={state}>{message}</small>}
      </div>
      <button onClick={testConnection} disabled={state === "loading"}>
        {state === "loading" ? "Testing…" : "Test connection"}
      </button>
    </article>
  );
}
