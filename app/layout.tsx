import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wasmvm - 0ms Browser POSIX Terminal (WASM & OPFS)",
  description:
    "Ultra-lightweight POSIX environment in the browser with 0ms startup, WebAssembly WASI execution, and native OPFS persistence.",
  keywords: ["webassembly", "wasm", "wasi", "opfs", "terminal", "posix", "linux", "browser os"],
  authors: [{ name: "wasmvm team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full bg-[#0a0f1d] text-slate-100 antialiased select-none">
      <body className="h-full w-full overflow-hidden flex flex-col bg-[#0a0f1d]">
        {children}
      </body>
    </html>
  );
}
