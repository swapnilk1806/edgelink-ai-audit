"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { Activity, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: UsersRound },
  { href: "/admin/audits", label: "Audit history", icon: Activity }
];

export default function AppShell({ role, email, children }: { role: "admin" | "client"; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const links = role === "admin"
    ? adminLinks
    : [{ href: "/client/dashboard", label: "My SEO overview", icon: LayoutDashboard }];
  const currentLabel = links.find((link) => pathname === link.href)?.label ?? links[0].label;
  const initials = email.split("@")[0].slice(0, 2);

  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed. Please retry.");
      window.location.assign("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Sign out failed. Please retry.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href={role === "admin" ? "/admin" : "/client/dashboard"} aria-label="Edgelink SEO home">
          <span className="brand-mark">e</span>
          <span className="brand-word">edgelink<small>SEO WORKSPACE</small></span>
        </a>
        <div className="workspace-label">{role} workspace</div>
        <nav className="nav-group" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin" && href !== "/client/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <a key={href} href={href} className={`navlink ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="account-avatar" aria-hidden="true">{initials}</div>
          <div className="account-copy">
            <strong>{role === "admin" ? "Administrator" : "Client account"}</strong>
            <span title={email}>{email}</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="shell-header">
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true"> / </span><strong>{currentLabel}</strong></div>
          <div className="shell-actions">
            <span className="shell-user">{email}</span>
            <Button variant="secondary" className="small" onClick={logout} disabled={signingOut} aria-label="Sign out">
              <LogOut size={14} aria-hidden="true" />
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </header>
        {error && <div className="notice" role="alert">{error}</div>}
        {children}
      </main>
    </div>
  );
}
