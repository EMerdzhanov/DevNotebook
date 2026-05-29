import { Node, mergeAttributes } from "@tiptap/react";

export interface FileCardAttributes {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    fileCard: {
      insertFileCard: (attrs: FileCardAttributes) => ReturnType;
    };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("application/pdf")) return "PDF";
  if (mimeType.startsWith("application/json")) return "JSON";
  if (mimeType.startsWith("application/zip") || mimeType.includes("gzip")) return "ZIP";
  if (mimeType.startsWith("text/")) return "TXT";
  if (mimeType.startsWith("video/")) return "VID";
  if (mimeType.startsWith("audio/")) return "AUD";
  return "FILE";
}

export const FileCard = Node.create({
  name: "fileCard",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      fileId: { default: "" },
      filename: { default: "" },
      mimeType: { default: "" },
      sizeBytes: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="file-card"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as FileCardAttributes;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "file-card",
        "data-file-id": attrs.fileId,
        class: "file-card-node",
        style:
          "display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid #333;border-radius:6px;background:#222;margin:8px 0;cursor:pointer;",
      }),
      [
        "div",
        {
          style:
            "display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:4px;background:#2a2a2a;font-size:11px;font-weight:bold;color:#666;flex-shrink:0;",
        },
        getTypeLabel(attrs.mimeType),
      ],
      [
        "div",
        { style: "flex:1;min-width:0;" },
        [
          "div",
          {
            style:
              "font-size:13px;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
          },
          attrs.filename,
        ],
        [
          "div",
          { style: "font-size:11px;color:#666;margin-top:2px;" },
          `${formatSize(attrs.sizeBytes)} · ${attrs.mimeType}`,
        ],
      ],
    ];
  },

  addCommands() {
    return {
      insertFileCard:
        (attrs: FileCardAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
