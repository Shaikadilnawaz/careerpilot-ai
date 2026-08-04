import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-context";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareerPilot AI",
  description:
    "AI-powered job application copilot — analyze your resume, track applications, and land the role.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* AuthProvider makes the current user available everywhere.       */}
        {/* `children` stay Server Components — only the provider is client. */}
        <AuthProvider>{children}</AuthProvider>
        {/* Toaster renders the toast notifications we trigger from forms.   */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
