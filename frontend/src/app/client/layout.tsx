import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppShell from "@/components/app-shell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "client") redirect("/admin");
  return <AppShell role="client" email={session.email}>{children}</AppShell>;
}
