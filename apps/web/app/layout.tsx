import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Trip Planner",
  description: "ELEC5620 multi-agent trip planning system — scaffold",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
