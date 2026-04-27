import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import CustomCursor from "@/components/CustomCursor";

export const metadata: Metadata = {
  title: "AI Stack Builder | Knight AI+AV",
  description: "Architect AI infrastructure with natural language prompts.",
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
          <img src="/assets/media/grand-library.webp" className="mural-slice" alt="" loading="lazy" width="1920" height="1080" />
          <img src="/assets/media/cathedral-vault.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" />
          <img src="/assets/media/library-nave.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" />
          <img src="/assets/media/cathedral-nave.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" />
          <img src="/assets/media/vaulted-hall.webp" className="mural-slice" alt="" loading="lazy" width="1024" height="1024" />
        </div>
        <CustomCursor />
        <TopNav />
        {children}
      </body>
    </html>
  );
}
