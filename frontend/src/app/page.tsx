import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  redirect(session?.role === "admin" ? "/admin" : session?.role === "client" ? "/client/dashboard" : "/login");
}
