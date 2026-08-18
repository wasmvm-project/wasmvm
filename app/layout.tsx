import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wasmvm - 0ms Browser POSIX OS (WASM & OPFS)",
  description:
    "Ultra-lightweight POSIX environment in the browser with 0ms startup, WebAssembly WASI execution, and native OPFS persistence.",
  keywords: ["webassembly", "wasm", "wasi", "opfs", "terminal", "posix", "linux", "browser os", "pwa"],
  authors: [{ name: "wasmvm-project" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "wasmvm",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0f1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full bg-[#0a0f1d] text-slate-100 antialiased select-none">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(
                    (reg) => console.log('[PWA] ServiceWorker registered with scope:', reg.scope),
                    (err) => console.warn('[PWA] ServiceWorker registration failed:', err)
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="h-full w-full overflow-hidden flex flex-col bg-[#0a0f1d]">
        {children}
      </body>
    </html>
  );
}
