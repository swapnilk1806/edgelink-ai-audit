import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edgelink SEO Console",
  description: "SEO audit operations and client reporting dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
