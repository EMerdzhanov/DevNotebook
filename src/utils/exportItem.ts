import { save } from "@tauri-apps/plugin-dialog";
import { writeExportFile } from "../hooks/useTauri";

// ── TipTap JSON to Markdown converter ──

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
}

function inlineToMarkdown(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") {
        let text = node.text || "";
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === "bold") text = `**${text}**`;
            else if (mark.type === "italic") text = `*${text}*`;
            else if (mark.type === "code") text = `\`${text}\``;
            else if (mark.type === "strike") text = `~~${text}~~`;
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

function listToMarkdown(node: TipTapNode, indent: number, ordered: boolean): string {
  const items = node.content || [];
  return items
    .map((item, idx) => {
      const prefix = ordered ? `${idx + 1}. ` : "- ";
      const pad = "  ".repeat(indent);
      const parts: string[] = [];
      let firstLine = true;
      for (const child of item.content || []) {
        if (child.type === "paragraph") {
          if (firstLine) {
            parts.push(`${pad}${prefix}${inlineToMarkdown(child.content)}`);
            firstLine = false;
          } else {
            parts.push(`${pad}  ${inlineToMarkdown(child.content)}`);
          }
        } else if (child.type === "bulletList") {
          parts.push(listToMarkdown(child, indent + 1, false));
        } else if (child.type === "orderedList") {
          parts.push(listToMarkdown(child, indent + 1, true));
        }
      }
      return parts.join("\n");
    })
    .join("\n");
}

function taskListToMarkdown(node: TipTapNode): string {
  const items = node.content || [];
  return items
    .map((item) => {
      const checked = item.attrs?.checked ? "x" : " ";
      const text = (item.content || [])
        .map((child) => {
          if (child.type === "paragraph") return inlineToMarkdown(child.content);
          return "";
        })
        .join(" ");
      return `- [${checked}] ${text}`;
    })
    .join("\n");
}

function tableToMarkdown(node: TipTapNode): string {
  const rows = node.content || [];
  if (rows.length === 0) return "";

  const matrix: string[][] = rows.map((row) =>
    (row.content || []).map((cell) =>
      (cell.content || [])
        .map((child) => {
          if (child.type === "paragraph") return inlineToMarkdown(child.content);
          return "";
        })
        .join(" ")
    )
  );

  if (matrix.length === 0) return "";

  const colCount = Math.max(...matrix.map((r) => r.length));
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.max(3, ...matrix.map((r) => (r[c] || "").length));
  }

  const formatRow = (row: string[]) =>
    "| " +
    Array.from({ length: colCount }, (_, c) => (row[c] || "").padEnd(colWidths[c])).join(" | ") +
    " |";

  const lines: string[] = [];
  lines.push(formatRow(matrix[0]));
  lines.push(
    "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |"
  );
  for (let r = 1; r < matrix.length; r++) {
    lines.push(formatRow(matrix[r]));
  }
  return lines.join("\n");
}

function nodeToMarkdown(node: TipTapNode): string {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) || 1;
      return `${"#".repeat(level)} ${inlineToMarkdown(node.content)}`;
    }
    case "paragraph":
      return inlineToMarkdown(node.content);
    case "bulletList":
      return listToMarkdown(node, 0, false);
    case "orderedList":
      return listToMarkdown(node, 0, true);
    case "taskList":
      return taskListToMarkdown(node);
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      const code = (node.content || []).map((c) => c.text || "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "blockquote": {
      const inner = (node.content || []).map(nodeToMarkdown).join("\n");
      return inner
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    }
    case "horizontalRule":
      return "---";
    case "table":
      return tableToMarkdown(node);
    default:
      if (node.content) {
        return node.content.map(nodeToMarkdown).join("\n");
      }
      return "";
  }
}

export function tiptapJsonToMarkdown(jsonStr: string): string {
  try {
    const doc = JSON.parse(jsonStr) as TipTapNode;
    if (!doc.content) return "";
    return doc.content.map(nodeToMarkdown).join("\n\n");
  } catch {
    return jsonStr;
  }
}

// ── Language to file extension map ──

const LANG_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  rust: "rs",
  go: "go",
  java: "java",
  ruby: "rb",
  "c#": "cs",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  sql: "sql",
  bash: "sh",
  yaml: "yml",
  json: "json",
  html: "html",
  css: "css",
  dockerfile: "dockerfile",
  terraform: "tf",
  graphql: "graphql",
};

function getExtension(language: string): string {
  return LANG_EXTENSIONS[language.toLowerCase()] || "txt";
}

// ── Export functions ──

export async function exportAsMarkdown(title: string, markdownContent: string): Promise<void> {
  const filename = sanitizeFilename(title) + ".md";
  const path = await save({
    title: "Export as Markdown",
    defaultPath: filename,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return;
  await writeExportFile(path, markdownContent);
}

export async function exportAsCode(title: string, code: string, language: string): Promise<void> {
  const ext = getExtension(language);
  const filename = sanitizeFilename(title) + "." + ext;
  const path = await save({
    title: "Export Code Snippet",
    defaultPath: filename,
    filters: [{ name: `${language || "Code"} file`, extensions: [ext] }],
  });
  if (!path) return;
  await writeExportFile(path, code);
}

export async function exportAsJson(title: string, data: unknown): Promise<void> {
  const filename = sanitizeFilename(title) + ".json";
  const path = await save({
    title: "Export as JSON",
    defaultPath: filename,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return;
  const content = JSON.stringify(data, null, 2);
  await writeExportFile(path, content);
}

function sanitizeFilename(name: string): string {
  return (name || "untitled")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}
