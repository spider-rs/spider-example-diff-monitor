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
            <path fillRule="evenodd" clipRule="evenodd" d="M20.646 5.196A2.25 2.25 0 0 0 17.199 2.304L15.447 4.391A4.5 4.5 0 0 1 8.553 4.391L6.801 2.304A2.25 2.25 0 0 0 3.354 5.196L8.697 11.564A4.5 4.5 0 0 1 9.75 14.457L9.75 20.25A2.25 2.25 0 0 0 14.25 20.25L14.25 14.457A4.5 4.5 0 0 1 15.303 11.564L20.646 5.196Z" />
          </svg>
          Spider.cloud
        </a>
      </footer>
      <Toaster />
    </main>
  );
}
