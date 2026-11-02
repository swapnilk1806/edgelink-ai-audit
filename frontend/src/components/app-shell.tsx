"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

export default function AppShell({ role, email, children }: { role: "admin" | "client"; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [error, setError] = useState("");
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    
    if (!response.ok) { setError("Sign out failed. Please retry."); return; }
    window.location.assign("/login");
  }
  const links = role === "admin" ? [["/admin", "Overview"], ["/admin/clients", "Clients"], ["/admin/audits", "Audit history"]] : [["/client/dashboard", "My SEO overview"]];
  return <div className="shell">
    <aside className="sidebar"><div className="brand">edgelink <span>SEO</span></div>
      <div className="subtle" style={{ color: "#839ca2", margin: "0 0 10px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{role} workspace</div>
      {links.map(([href, label]) => <a key={href} href={href} className={`navlink ${pathname === href ? "active" : ""}`}>{label}</a>)}
      <div style={{ position: "absolute", bottom: 20, color: "#afc2c6", fontSize: 12, padding: "0 12px" }}>{email}</div>
    </aside>
    <main className="main">
      {error && <div className="notice">{error}</div>}
      <div className="topline"><div className="subtle">SEO operations / {role}</div><Button variant="secondary" onClick={logout}>Sign out</Button></div>
      {children}
    </main>
  </div>;
}
