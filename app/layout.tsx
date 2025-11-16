import type { Metadata } from "next";
import "./globals.css";
import "./blocks.css";

export const metadata: Metadata = {
  title: "Draehi - Deploy your Logseq graph",
  description: "Deploy your Logseq graph to the web in 60 seconds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
