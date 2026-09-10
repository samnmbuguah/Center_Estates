"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, FileText, Image as ImageIcon, Loader2, Paperclip, UploadCloud, X } from "lucide-react";

export type UploadedAttachment = {
  url: string;
  name: string;
  size?: number;
  type?: string;
};

export function EvidenceAttachmentUploader({
  attachment,
  onChange,
  onUpload,
  disabled,
  compact = false,
}: {
  attachment: UploadedAttachment | null;
  onChange: (att: UploadedAttachment | null) => void;
  onUpload: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global & scoped clipboard paste listener (Ctrl+V screenshot support)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (disabled || uploading || attachment) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            void handleFile(file);
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [disabled, uploading, attachment]);

  async function handleFile(file: File) {
    if (!file || disabled || uploading) return;
    setUploading(true);
    try {
      const res = await onUpload(file);
      if (res && res.url) {
        onChange({
          url: res.url,
          name: res.name || file.name,
          size: res.size || file.size,
          type: file.type,
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function formatBytes(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isImage = attachment?.url && (
    /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(attachment.url) ||
    attachment.type?.startsWith("image/")
  );

  const isVideo = attachment?.url && (
    /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(attachment.url) ||
    attachment.type?.startsWith("video/")
  );

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          disabled={disabled || uploading}
        />

        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            <Loader2 size={14} className="spin" /> Uploading media evidence…
          </div>
        ) : attachment ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {isImage ? <ImageIcon size={14} style={{ color: "var(--color-blue)" }} /> : isVideo ? <span style={{ fontSize: 13 }}>📹</span> : <FileText size={14} style={{ color: "var(--color-slate-500)" }} />}
            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
              {attachment.name}
            </span>
            {attachment.size ? <span className="muted" style={{ fontSize: 10 }}>({formatBytes(attachment.size)})</span> : null}
            <button
              type="button"
              onClick={() => onChange(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex", alignItems: "center" }}
              title="Remove attachment"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px" }}
            title="Attach photo, video or document evidence (or press Ctrl+V to paste)"
          >
            <Paperclip size={14} /> Attach Photo / Video / File
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        disabled={disabled || uploading}
      />

      {attachment ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {isImage ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "#000",
                  flexShrink: 0,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                }}
                onClick={() => setPreviewOpen(true)}
                title="Click to view full image preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ) : isVideo ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "var(--color-slate-900)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  flexShrink: 0,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  fontSize: 22,
                }}
                onClick={() => setPreviewOpen(true)}
                title="Click to play video preview"
              >
                ▶️
              </div>
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  background: "rgba(59, 130, 246, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-blue)",
                  flexShrink: 0,
                }}
              >
                <FileText size={24} />
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {attachment.name}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {attachment.size && <span>{formatBytes(attachment.size)}</span>}
                <span style={{ color: "var(--color-success)", display: "flex", alignItems: "center", gap: 2 }}>
                  <Check size={11} /> Ready to submit
                </span>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--primary)", textDecoration: "underline", marginLeft: 4 }}
                >
                  Open in tab
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onChange(null)}
            style={{ color: "var(--color-danger)", padding: "4px 8px" }}
            title="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          onClick={() => {
            if (!uploading && !disabled) fileInputRef.current?.click();
          }}
          style={{
            border: isDragOver ? "2px dashed var(--primary)" : "2px dashed var(--border)",
            background: isDragOver ? "rgba(59, 130, 246, 0.05)" : "var(--surface-2)",
            borderRadius: 8,
            padding: "16px 20px",
            textAlign: "center",
            cursor: uploading || disabled ? "not-allowed" : "pointer",
            transition: "all 0.15s ease-in-out",
          }}
        >
          {uploading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--muted)" }}>
              <Loader2 size={24} className="spin" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading evidence file…</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
                <UploadCloud size={20} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Click or drag & drop photo, video or document evidence here
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Supports PNG, JPG, WEBP, MP4, MOV, PDF, DOCX (up to 25 MB) · <strong style={{ color: "var(--primary)" }}>Tip: Press Ctrl+V anytime to paste screenshot directly</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expanded Modal Preview */}
      {previewOpen && attachment?.url && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                background: "#000",
                color: "#fff",
                border: "2px solid #fff",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>
            {isVideo ? (
              <video
                src={attachment.url}
                controls
                autoPlay
                style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.5)", background: "#000" }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={attachment.url}
                alt={attachment.name}
                style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
