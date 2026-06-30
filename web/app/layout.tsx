import type { Metadata } from "next";
import Image from "next/image";
import { Analytics } from "@vercel/analytics/next";
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
          <a
            href="https://github.com/ttang1024/landcare"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5a11.5 11.5 0 0 0-3.636 22.42c.575.106.786-.25.786-.555 0-.274-.01-1-.015-1.962-3.198.695-3.873-1.542-3.873-1.542-.523-1.328-1.277-1.682-1.277-1.682-1.043-.713.08-.699.08-.699 1.153.081 1.76 1.184 1.76 1.184 1.025 1.757 2.69 1.25 3.345.955.104-.742.401-1.25.73-1.538-2.553-.29-5.238-1.277-5.238-5.683 0-1.256.448-2.282 1.184-3.087-.119-.29-.513-1.46.112-3.045 0 0 .966-.31 3.165 1.178a11.02 11.02 0 0 1 5.764 0c2.198-1.489 3.162-1.178 3.162-1.178.627 1.585.233 2.755.114 3.045.738.805 1.183 1.831 1.183 3.087 0 4.417-2.69 5.39-5.252 5.674.413.355.78 1.057.78 2.131 0 1.539-.014 2.781-.014 3.159 0 .308.208.667.792.554A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </header>
        <main id="map" className="min-h-0 flex-1">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
