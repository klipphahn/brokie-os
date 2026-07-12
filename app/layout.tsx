import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brokie OS — Founders Builder",
  description: "Build and publish The Brokie Founders Collection."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
