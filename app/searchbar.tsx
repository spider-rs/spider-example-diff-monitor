"use client";

import React, { Dispatch, SyntheticEvent, useEffect, useRef, useState } from "react";
import { VscLoading, VscSearch, VscSettings } from "react-icons/vsc";
import ms from "ms";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AuthDropdown, { useAuthMenu } from "./auth";
import AppSwitcher from "./app-switcher";
import { savePages } from "@/lib/storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.spider.cloud";

const SearchBar = ({
  setDataValues,
  onSaveComplete,
}: {
  setDataValues: Dispatch<any>;
  onSaveComplete?: () => void;
}) => {
  const [url, setURl] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [crawlLimit, setCrawlLimit] = useState(50);
  const [returnFormat, setReturnFormat] = useState("raw");
  const [apiKey, setAPIKey] = useState("");
  const [request, setRequest] = useState("smart");
  const [fullResources, setFullResources] = useState(false);
  const crawledPagesRef = useRef<any[]>([]);
  const streamBufferRef = useRef("");
  const auth = useAuthMenu();
  const { toast } = useToast();

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("url");
    if (prefill) setURl(prefill);
  }, []);

  const onAPIEvent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const jwt = auth.$session?.access_token;
    if (!jwt) {
      return toast({ title: "Authentication Required", description: "Please login or register." });
    }
    if (!url) {
      return toast({ title: "URL Required", description: "Please enter a valid website url." });
    }
    const urlList = url.trim().split(",").map((item) =>
      item.startsWith("http://") || item.startsWith("https://") ? item.trim() : `https://${item.trim()}`
    ).filter(Boolean);
    setDataLoading(true);
    crawledPagesRef.current = [];
    streamBufferRef.current = "";
    const current = performance.now();
    let pages = 0;
    let finished = false;
    toast({ title: "Crawling started", description: `Fetching up to ${crawlLimit} pages from ${urlList.length} website${urlList.length === 1 ? "" : "s"}...` });
    try {
      const res = await fetch(API_URL + "/crawl", {
        method: "POST",
        body: JSON.stringify({ url: urlList.join(","), limit: crawlLimit, return_format: returnFormat, request, ...(fullResources && { full_resources: true }) }),
        headers: { "content-type": "application/jsonl", authorization: apiKey || jwt },
      });
      if (!res.ok) {
        toast({ title: "Crawl failed", description: `Server returned ${res.status}. Check your API key and credits.`, variant: "destructive" });
      } else {
        finished = true;
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (streamBufferRef.current.trim()) {
                try { const p = JSON.parse(streamBufferRef.current.trim()); crawledPagesRef.current.push(p); pages++; setDataValues((prev: any) => prev ? [...prev, p] : [p]); } catch {}
              }
              break;
            }
            streamBufferRef.current += decoder.decode(value, { stream: true });
            const lines = streamBufferRef.current.split("\n");
            streamBufferRef.current = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try { const parsed = JSON.parse(trimmed); crawledPagesRef.current.push(parsed); pages++; setDataValues((prev: any) => prev ? [...prev, parsed] : [parsed]); } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Network error", description: "Could not reach the server. Please try again.", variant: "destructive" });
    } finally {
      setDataLoading(false);
      streamBufferRef.current = "";
      if (!finished && !pages) {
        // error toast already shown above
      } else if (finished) {
        toast({ title: "Crawl complete", description: `${pages} page${pages === 1 ? "" : "s"} crawled in ${ms(performance.now() - current, { long: true })}.` });
        if (crawledPagesRef.current.length) {
          savePages(crawledPagesRef.current).then(() => onSaveComplete?.()).catch(console.error);
        }
      }
      crawledPagesRef.current = [];
    }
  };

  return (
    <>
      <nav className="relative z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 py-2.5 px-4">
          <a href="https://spider.cloud" target="_blank" rel="noreferrer" className="flex gap-2.5 items-center shrink-0 group">
            <svg height={24} width={24} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-[#3bde77] shrink-0 group-hover:scale-110 transition-transform">
              <title>Spider</title>
              <path fillRule="evenodd" clipRule="evenodd" d="M1.5 1.5H7.5V7.5H1.5zM16.5 1.5H22.5V7.5H16.5zM1.5 16.5H7.5V22.5H1.5zM16.5 16.5H22.5V22.5H16.5zM7.5 3H16.5V6H7.5zM3 7.5H6V16.5H3zM7.5 6H8.25L18.75 16.5H16.5V18.75L6 8.25V7.5H7.5z" />
            </svg>
            <h1 className="text-sm font-semibold truncate hidden sm:block">Spider Diff Monitor</h1>
          </a>
          {auth?.$session ? (
            <form className="flex items-center gap-2 flex-1 min-w-0 justify-end" onSubmit={onAPIEvent} noValidate>
              <div className="relative w-full max-w-xs sm:max-w-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <VscSearch className="w-4 h-4 text-muted-foreground" />
                </div>
                <Label htmlFor="website-form" className="sr-only">Crawl Website</Label>
                <Input
                  type="text"
                  id="website-form"
                  className="pl-9 pr-3 h-9 text-sm w-full rounded-lg border-muted-foreground/25 bg-muted/40 placeholder:text-muted-foreground/50 focus-visible:ring-[#3bde77]/40 focus-visible:border-[#3bde77]/50 transition-colors"
                  placeholder="Enter website URL to crawl..."
                  value={url}
                  onChange={(e) => setURl(e.currentTarget.value)}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={dataLoading}
                className="bg-[#3bde77] hover:bg-[#2bc866] text-black font-medium h-9 px-4 rounded-lg shrink-0 disabled:opacity-70"
              >
                {dataLoading ? (
                  <><VscLoading className="motion-safe:animate-spin w-3.5 h-3.5 mr-1.5" />Crawling</>
                ) : (
                  "Crawl"
                )}
              </Button>
            </form>
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-1 shrink-0">
            <AppSwitcher currentUrl={url} />
            {auth?.$session ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfigModalOpen(true)} className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                <VscSettings className="w-4 h-4" />
              </Button>
            ) : null}
            <AuthDropdown {...auth} />
          </div>
        </div>
      </nav>
      {configModalOpen && (
        <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
          <DialogOverlay />
          <DialogContent className="p-4 rounded-md shadow-md">
            <DialogHeader>
              <DialogTitle>Configuration</DialogTitle>
              <DialogDescription>Set your crawl options.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center">
                <Label htmlFor="crawlLimit" className="flex-1">Crawl Limit:</Label>
                <Input type="number" id="crawlLimit" className="w-1/2" value={crawlLimit} onChange={(e) => setCrawlLimit(Number(e.currentTarget.value))} min="1" max="1000" />
              </div>
              <div className="flex items-center">
                <Label className="flex-1">Return Format:</Label>
                <Select onValueChange={setReturnFormat} defaultValue={returnFormat}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center">
                <Label className="flex-1">Request:</Label>
                <Select onValueChange={setRequest} defaultValue={request}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="chrome">Chrome</SelectItem>
                    <SelectItem value="smart">Smart Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center">
                <Label className="flex-1">Full Resources:</Label>
                <Select onValueChange={(v: string) => setFullResources(v === "true")} defaultValue="false">
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Off</SelectItem>
                    <SelectItem value="true">On</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sk-key">API Key</Label>
                <Input placeholder="sk-somesecret" type="password" id="sk-key" onChange={(e) => setAPIKey(e.currentTarget.value)} />
                <p className="py-2 text-sm text-muted-foreground">This key is only used in the current session.</p>
              </div>
              <Button type="button" onClick={() => setConfigModalOpen(false)} className="self-end">Save</Button>
              <div className="pt-10 pb-2 flex place-content-end border-t">
                <Button onClick={async () => { await auth.signOut(); setConfigModalOpen(false); }} variant="destructive">Logout</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SearchBar;
