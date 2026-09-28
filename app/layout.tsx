import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Daymark Demo — Tasks & Notes", description: "Try Daymark: tasks, notes, priorities, progress, and deadline alerts.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
