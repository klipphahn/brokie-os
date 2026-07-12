"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <button className="logoutButton" onClick={logout} type="button">
      <LogOut size={16} /> Sign out
    </button>
  );
}
