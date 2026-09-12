import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "مپ‌پی‌ام‌اس | سامانه مدیریت پروژه و اتوماسیون تأسیسات",
  description:
    "MEP-PMS — سامانه یکپارچه مدیریت پروژه‌ها، قراردادها، اکیپ‌های اجرایی، تراز مصالح، تسویه و پیگیری هوشمند شرکت‌های تأسیسات ساختمانی",
  keywords: ["مدیریت پروژه", "تأسیسات ساختمانی", "مپ‌پی‌ام‌اس", "MEP", "قرارداد", "تراز مصالح"],
  applicationName: "MEP-PMS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground font-vazir">
        {/* جهت RTL برای همه کامپوننت‌های Radix مستقیماً در src/components/ui/*.tsx تنظیم شده
            (پکیج @radix-ui/react-direction@1.1.1 بیلد CJS خراب دارد) */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
