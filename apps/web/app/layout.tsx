import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Trip Planner",
  description: "A human-in-the-loop, multi-agent trip planning workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
