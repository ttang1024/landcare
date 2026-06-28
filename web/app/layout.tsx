import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catchments Map — LandcareLink",
  description:
    "A national view of catchment collectives, catchment groups, and environmental community groups across Aotearoa New Zealand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-dvh flex-col overflow-hidden">
        <a href="#map" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">
          Skip to map
        </a>
        <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3">
          <Image
            src="/images/logo.png"
            alt="LandcareLink"
            width={1100}
            height={968}
            priority
            className="h-8 w-auto"
          />
          <span className="font-semibold text-(--color-landcare-green)">LandcareLink</span>
          <span className="hidden text-sm text-neutral-500 sm:inline">Catchments Map</span>
        </header>
        <main id="map" className="min-h-0 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
