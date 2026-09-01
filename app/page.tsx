import Monitor from "./monitor";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Monitor />
      <section className="border-t px-6 py-8 max-w-2xl mx-auto text-center text-sm text-muted-foreground">
        <h2 className="text-base font-medium text-foreground mb-3">
          Website Diff Monitor
        </h2>
        <p className="mb-3">
          Monitor any website for content changes over time.
        </p>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          <li>Side-by-side diffs</li>
          <li>Crawl history</li>
          <li>Real-time streaming</li>
        </ul>
      </section>
      <footer className="flex items-center justify-center gap-2 py-3 border-t text-xs text-muted-foreground">
        <span>Powered by</span>
        <a href="https://spider.cloud" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-[#3bde77] transition-colors">
          <svg height={14} width={14} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-[#3bde77]">
            <path fillRule="evenodd" clipRule="evenodd" d="M1.5 1.5H7.5V7.5H1.5zM16.5 1.5H22.5V7.5H16.5zM1.5 16.5H7.5V22.5H1.5zM16.5 16.5H22.5V22.5H16.5zM7.5 3H16.5V6H7.5zM3 7.5H6V16.5H3zM7.5 6H8.25L18.75 16.5H16.5V18.75L6 8.25V7.5H7.5z" />
          </svg>
          Spider.cloud
        </a>
      </footer>
      <Toaster />
    </main>
  );
}
