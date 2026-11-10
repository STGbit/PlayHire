import type { Metadata } from "next";
import "./globals.css";
import "./extra.css";
export const metadata: Metadata = { title: "playhire.", description: "Find the right replacement for every match." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
