import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppShell from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/client/dashboard");
  return <AppShell role="admin" email={session.email}>{children}</AppShell>;
}
