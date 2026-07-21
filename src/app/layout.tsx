import type { Metadata, Viewport } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import CustomCursor from "@/components/CustomCursor";
import Image from "next/image";

export const metadata: Metadata = {
  title: "AI Stack Builder | Knight AI+AV",
  description: "Architect AI infrastructure with natural language prompts.",
  applicationName: "AI Stack Builder",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI Stack Builder",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#08080a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mural-canvas" aria-hidden="true">
          <Image src="/assets/media/grand-library.webp" className="mural-slice" alt="" loading="lazy" width="1920" height="1080" unoptimized />
          <Image src="/assets/media/cathedral-vault.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" unoptimized />
          <Image src="/assets/media/library-nave.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" unoptimized />
          <Image src="/assets/media/cathedral-nave.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" unoptimized />
          <Image src="/assets/media/vaulted-hall.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" unoptimized />
        </div>
        <CustomCursor />
        <TopNav />
        {children}
      </body>
    </html>
  );
}
