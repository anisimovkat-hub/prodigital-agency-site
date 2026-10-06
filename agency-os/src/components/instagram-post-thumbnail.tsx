"use client";

import { useState } from "react";
import { SiInstagram } from "react-icons/si";

/** Saved Meta preview URLs can expire; keep the report readable when they do. */
export function InstagramPostThumbnail({ src }: { src?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-400">
    {src && failedUrl !== src ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailedUrl(src)} /> : <SiInstagram className="size-4" aria-hidden="true" />}
  </span>;
}
