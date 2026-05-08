import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn("font-sans", inter.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
