"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Eye, FileText, FileType, ImageIcon } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";

interface FileViewerProps {
  filePath: string;
  content: string;
  fileUrl: string;
  isLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string;
  onChangeContent: (nextContent: string) => void;
  onSave: () => void;
}

function getFileName(filePath: string) {
  return filePath.split("/").pop() || "";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function isImageFile(fileName: string) {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(
    getFileExtension(fileName)
  );
}

function isPdfFile(fileName: string) {
  return getFileExtension(fileName) === "pdf";
}

function getLanguageLabel(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  const extension = getFileExtension(fileName);

  if (lowerFileName === "dockerfile") return "dockerfile";
  if (isImageFile(fileName)) return "image";
  if (isPdfFile(fileName)) return "pdf";

  const labels: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    css: "css",
    scss: "scss",
    html: "html",
    md: "markdown",
    mdx: "markdown",
    py: "python",
    sql: "sql",
    xml: "xml",
    svg: "svg",
    yml: "yaml",
    yaml: "yaml",
    rs: "rust",
    go: "go",
    env: "env",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    txt: "text",
  };

  return labels[extension] || "text";
}

function getCodeMirrorExtensions(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  const extension = getFileExtension(fileName);

  if (lowerFileName === "dockerfile") {
    return [];
  }

  switch (extension) {
    case "js":
    case "jsx":
      return [javascript({ jsx: true })];

    case "ts":
    case "tsx":
      return [javascript({ jsx: extension === "tsx", typescript: true })];

    case "json":
      return [json()];

    case "css":
    case "scss":
      return [css()];

    case "html":
      return [html()];

    case "md":
    case "mdx":
      return [markdown()];

    case "py":
      return [python()];

    case "sql":
      return [sql()];

    case "xml":
    case "svg":
      return [xml()];

    case "yml":
    case "yaml":
      return [yaml()];

    case "rs":
      return [rust()];

    case "go":
      return [go()];

    default:
      return [];
  }
}

function CodeViewer({
  fileName,
  content,
  editable,
  onChange,
}: {
  fileName: string;
  content: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const extensions = useMemo(() => {
    return [
      ...getCodeMirrorExtensions(fileName),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          height: "100%",
          backgroundColor: "transparent",
          fontSize: "12px",
        },

        ".cm-editor": {
          height: "100%",
        },

        ".cm-scroller": {
          height: "100%",
          overflow: "auto",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },

        ".cm-content": {
          minHeight: "100%",
          padding: "16px 0",
        },

        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--border-main)",
        },

        ".cm-line": {
          padding: "0 16px",
        },

        ".cm-activeLine": {
          backgroundColor: "rgba(255,255,255,0.04)",
        },

        ".cm-activeLineGutter": {
          backgroundColor: "rgba(255,255,255,0.04)",
        },
      }),
    ];
  }, [fileName]);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border-main bg-bg-raised">
      <CodeMirror
        value={content}
        onChange={onChange}
        className="h-full"
        height="100%"
        theme={oneDark}
        extensions={extensions}
        editable={editable}
        readOnly={!editable}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          searchKeymap: true,
        }}
      />
    </div>
  );
}

function ImageViewer({
  fileName,
  fileUrl,
}: {
  fileName: string;
  fileUrl: string;
}) {
  return (
    <div className="h-full min-h-0 overflow-auto rounded-lg border border-border-main bg-bg-raised custom-scrollbar flex items-center justify-center p-6">
      <img
        src={fileUrl}
        alt={fileName}
        className="max-w-full max-h-full object-contain rounded"
      />
    </div>
  );
}

function PdfViewer({
  fileName,
  fileUrl,
}: {
  fileName: string;
  fileUrl: string;
}) {
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border-main bg-bg-raised">
      <iframe
        src={fileUrl}
        title={fileName}
        className="h-full w-full border-0"
      />
    </div>
  );
}

export function FileViewer({
  filePath,
  content,
  fileUrl,
  isLoading,
  isDirty,
  isSaving,
  saveError,
  onChangeContent,
  onSave,
}: FileViewerProps) {
  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center font-mono text-sm text-text-3">
        <div className="animate-pulse">LOADING CONTENT //...</div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center font-mono text-text-3 gap-2">
        <Eye size={24} className="opacity-40" />

        <div className="text-[11px] tracking-wider">
          SELECT A FILE TO VIEW CONTENT
        </div>
      </div>
    );
  }

  const fileName = getFileName(filePath);
  const isMarkdown = fileName.toLowerCase().endsWith(".md");
  const isImage = isImageFile(fileName);
  const isPdf = isPdfFile(fileName);
  const languageLabel = getLanguageLabel(fileName);
  const canEdit = !isImage && !isPdf;

  const HeaderIcon = isImage ? ImageIcon : isPdf ? FileType : FileText;

  return (
    <div className="flex-1 min-h-0 min-w-0 h-full flex flex-col bg-bg-base border-l border-border-main">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border-main bg-bg-surface px-4 font-mono text-xs text-text-2">
        <HeaderIcon size={12} />

        <span className="truncate">
          {fileName}
          {isDirty ? <span className="text-accent"> *</span> : null}
        </span>

        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-accent hover:underline"
          >
            OPEN
          </a>
        )}

        {canEdit && (
          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="ml-2 rounded border border-border-main px-2 py-0.5 text-[10px] text-text-2 hover:text-text-1 hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? "SAVING..." : "SAVE"}
          </button>
        )}

        {saveError && (
          <span className="text-[10px] text-red-400 truncate">
            {saveError}
          </span>
        )}

        <span className="ml-auto text-[10px] uppercase tracking-widest text-text-3">
          {languageLabel}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-6 font-mono text-sm text-text-1 selection:bg-accent/20">
        {isImage && fileUrl ? (
          <ImageViewer fileName={fileName} fileUrl={fileUrl} />
        ) : isPdf && fileUrl ? (
          <PdfViewer fileName={fileName} fileUrl={fileUrl} />
        ) : isMarkdown ? (
          <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-6 overflow-hidden">
            <div className="h-full min-h-0 overflow-hidden">
              <CodeViewer
                fileName={fileName}
                content={content}
                editable
                onChange={onChangeContent}
              />
            </div>

            <article
              className="h-full min-h-0 overflow-y-auto rounded-lg border border-border-main bg-bg-raised p-6 custom-scrollbar prose prose-invert max-w-none
              prose-headings:font-mono prose-headings:text-text-1
              prose-p:text-text-2 prose-p:leading-relaxed
              prose-a:text-accent
              prose-strong:text-text-1
              prose-code:text-accent prose-code:bg-bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-bg-surface prose-pre:border prose-pre:border-border-main"
            >
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <CodeViewer
            fileName={fileName}
            content={content}
            editable
            onChange={onChangeContent}
          />
        )}
      </div>
    </div>
  );
}
