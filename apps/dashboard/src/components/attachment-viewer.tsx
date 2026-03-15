"use client";

import { useState } from "react";
import type { Attachment } from "@agent-lens/protocol";

interface AttachmentViewerProps {
  attachments: Attachment[];
}

const TYPE_ICONS: Record<string, string> = {
  image: "IMG",
  screenshot: "SCR",
  video: "VID",
  audio: "AUD",
  sensor_data: "SNS",
  document: "DOC",
};

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-bold tracking-widest text-[--text-secondary] mb-2 uppercase">
        Attachments ({attachments.length})
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((att) => (
          <AttachmentThumbnail
            key={att.id}
            attachment={att}
            expanded={expandedId === att.id}
            onToggle={() => setExpandedId(expandedId === att.id ? null : att.id)}
          />
        ))}
      </div>

      {/* Expanded overlay */}
      {expandedId && (
        <AttachmentExpanded
          attachment={attachments.find((a) => a.id === expandedId)!}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}

function AttachmentThumbnail({
  attachment,
  expanded,
  onToggle,
}: {
  attachment: Attachment;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasPreview = attachment.type === "image" || attachment.type === "screenshot";
  const thumbnailSrc = attachment.thumbnailBase64 ?? attachment.dataBase64;
  const icon = TYPE_ICONS[attachment.type] ?? "ATT";

  return (
    <button
      onClick={onToggle}
      className={`
        relative rounded-lg border overflow-hidden cursor-pointer transition-all
        ${expanded ? "ring-2 ring-blue-400" : "border-[--border] hover:border-blue-400/50"}
        ${hasPreview && thumbnailSrc ? "aspect-video" : "aspect-square"}
        bg-[--bg-primary]
      `}
    >
      {hasPreview && thumbnailSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailSrc.startsWith("data:") ? thumbnailSrc : `data:${attachment.mimeType};base64,${thumbnailSrc}`}
          alt={attachment.label ?? "attachment"}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <span className="text-lg font-bold text-[--text-secondary] opacity-30">{icon}</span>
        </div>
      )}

      {/* Badge */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-0.5">
        <div className="text-[9px] text-white truncate">
          {attachment.label ?? attachment.type}
        </div>
      </div>

      {/* Size indicator */}
      {attachment.sizeBytes != null && (
        <div className="absolute top-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-white/70">
          {formatSize(attachment.sizeBytes)}
        </div>
      )}
    </button>
  );
}

function AttachmentExpanded({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const imageSrc = attachment.dataBase64 ?? attachment.url;
  const isImage = attachment.type === "image" || attachment.type === "screenshot";

  return (
    <div className="mt-3 bg-[--bg-primary] border border-[--border] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[--border]">
        <div>
          <div className="text-xs font-medium">{attachment.label ?? attachment.type}</div>
          <div className="text-[10px] text-[--text-secondary] flex gap-2 mt-0.5">
            <span>{attachment.mimeType}</span>
            {attachment.width != null && attachment.height != null && (
              <span>{attachment.width}x{attachment.height}</span>
            )}
            {attachment.sizeBytes != null && (
              <span>{formatSize(attachment.sizeBytes)}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[--text-secondary] hover:text-white text-sm cursor-pointer"
        >
          x
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        {isImage && imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc.startsWith("data:") || imageSrc.startsWith("http")
              ? imageSrc
              : `data:${attachment.mimeType};base64,${imageSrc}`}
            alt={attachment.label ?? ""}
            className="max-w-full max-h-96 rounded mx-auto"
          />
        ) : attachment.type === "video" && attachment.url ? (
          <video src={attachment.url} controls className="max-w-full max-h-96 rounded mx-auto" />
        ) : attachment.type === "audio" && attachment.url ? (
          <audio src={attachment.url} controls className="w-full" />
        ) : (
          <div className="text-center py-8 text-[--text-secondary] text-xs">
            Preview not available for {attachment.mimeType}
            {attachment.url && (
              <div className="mt-2">
                <a href={attachment.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 underline">
                  Open in new tab
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      {attachment.metadata && Object.keys(attachment.metadata).length > 0 && (
        <div className="px-3 py-2 border-t border-[--border]">
          <div className="text-[9px] font-bold tracking-widest text-[--text-secondary] uppercase mb-1">
            Metadata
          </div>
          <pre className="text-[10px] text-[--text-secondary]">
            {JSON.stringify(attachment.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
