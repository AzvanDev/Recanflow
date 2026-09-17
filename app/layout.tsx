import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ReCan Flow", description: "Visual AI research workspace" };

// Runs synchronously before first paint so the correct theme is already applied when React
// hydrates — avoids a flash of the wrong theme. Sets an attribute React didn't render, so
// <html> needs suppressHydrationWarning (the standard pattern for this) to stop React from
// flagging the intentional mismatch.
const themeInitScript = `(function(){try{var t=localStorage.getItem("recan-flow-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
