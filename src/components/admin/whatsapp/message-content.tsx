"use client";

import {
  Download,
  FileText,
  Headphones,
  Image as ImageIcon,
  MapPin,
  Mic,
  Sticker,
  UserSquare2,
  Video as VideoIcon,
} from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Lightbox } from "@/components/admin/whatsapp/lightbox";
import { cn } from "@/lib/utils";

export type MessageMedia = {
  messageId: string;
  providerMessageId: string | null;
  mediaType: string;
  hasMedia: boolean;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  location: { latitude: number; longitude: number; description: string | null } | null;
};

export function MessageContent({
  body,
  media,
  highlight,
}: {
  body: string;
  media: MessageMedia;
  highlight?: ReactNode;
}) {
  const text = highlight ?? body;
  const mediaUrl = media.hasMedia
    ? `/api/whatsapp/media/file/${encodeURIComponent(media.messageId)}`
    : null;

  if (media.location) {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={`https://www.google.com/maps?q=${media.location.latitude},${media.location.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs text-foreground hover:bg-white"
        >
          <MapPin className="h-4 w-4 text-[var(--primary)]" />
          <span>
            {media.location.description
              ? media.location.description
              : `${media.location.latitude.toFixed(4)}, ${media.location.longitude.toFixed(4)}`}
          </span>
        </a>
        {body && body !== "[Ubicación]" && (
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        )}
      </div>
    );
  }

  if (media.mediaType === "image" && mediaUrl) {
    return <ImageMessage url={mediaUrl} caption={body} highlight={highlight} />;
  }

  if (media.mediaType === "sticker" && mediaUrl) {
    return (
      <div className="flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl} alt="Sticker" className="h-32 w-32 rounded-md object-contain" />
      </div>
    );
  }

  if (media.mediaType === "video" && mediaUrl) {
    return (
      <div className="flex flex-col gap-2">
        <video
          src={mediaUrl}
          controls
          preload="metadata"
          className="block max-h-80 w-full max-w-[280px] rounded-lg bg-black/5"
        />
        {body && body !== "[Vídeo]" && (
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        )}
      </div>
    );
  }

  if ((media.mediaType === "audio" || media.mediaType === "ptt") && mediaUrl) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs">
          {media.mediaType === "ptt" ? (
            <Mic className="h-3.5 w-3.5 text-[var(--primary)]" />
          ) : (
            <Headphones className="h-3.5 w-3.5 text-[var(--primary)]" />
          )}
          <audio src={mediaUrl} controls preload="none" className="h-7 max-w-[220px]" />
        </div>
      </div>
    );
  }

  if (media.mediaType === "document" && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl bg-white/60 px-3 py-2 hover:bg-white"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <FileText className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium">
            {media.mediaFilename ?? "documento"}
          </span>
          <span className="text-[10px] text-[var(--muted)]">
            {formatBytes(media.mediaSize)} · {media.mediaMime ?? "archivo"}
          </span>
        </span>
        <Download className="ml-auto h-4 w-4 text-[var(--muted)]" />
      </a>
    );
  }

  if (media.mediaType === "vcard" || media.mediaType === "multi_vcard") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs">
        <UserSquare2 className="h-4 w-4 text-[var(--primary)]" />
        <span>Contacto compartido</span>
      </div>
    );
  }

  // Tipos desconocidos con media pero sin handler específico.
  if (media.hasMedia && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md bg-white/60 px-2 py-1 text-xs hover:bg-white"
      >
        <MediaIcon type={media.mediaType} />
        Descargar adjunto
      </a>
    );
  }

  // Fallback: texto plano
  return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
}

function ImageMessage({
  url,
  caption,
  highlight,
}: {
  url: string;
  caption: string;
  highlight?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={caption || "Imagen"}
          className="block h-auto max-h-72 w-full max-w-[280px] rounded-lg object-cover"
        />
      </button>
      {caption && caption !== "[Imagen]" && (
        <p className={cn("whitespace-pre-wrap leading-relaxed")}>{highlight ?? caption}</p>
      )}
      <Lightbox open={open} src={url} alt={caption} onClose={() => setOpen(false)} />
    </div>
  );
}

function MediaIcon({ type }: { type: string }) {
  if (type === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (type === "video") return <VideoIcon className="h-3.5 w-3.5" />;
  if (type === "audio" || type === "ptt") return <Mic className="h-3.5 w-3.5" />;
  if (type === "sticker") return <Sticker className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

function formatBytes(size: number | null): string {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// Componente Image de Next no se usa aquí — los IDs son dinámicos y el dominio es propio.
// Lo importamos sólo para evitar warning de unused.
void Image;
