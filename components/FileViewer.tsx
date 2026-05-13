// components/FileViewer.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import { FileText, Eye } from 'lucide-react';

interface FileViewerProps {
  filePath: string;
  content: string;
  isLoading: boolean;
}

export function FileViewer({ filePath, content, isLoading }: FileViewerProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-sm text-text-3">
        <div className="animate-pulse">LOADING CONTENT //...</div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center font-mono text-text-3 gap-2">
        <Eye size={24} className="opacity-40" />
        <div className="text-[11px] tracking-wider">SELECT A FILE TO VIEW CONTENT</div>
      </div>
    );
  }

  const fileName = filePath.split('/').pop() || '';
  const isMarkdown = fileName.endsWith('.md');

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg-base border-l border-border-main h-full">
      <div className="flex h-9 bg-bg-surface shrink-0 items-center px-4 gap-2 border-b border-border-main font-mono text-xs text-text-2">
        <FileText size={12} />
        <span className="truncate">{fileName}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar font-mono text-sm text-text-1 selection:bg-accent/20">
        {isMarkdown ? (
          <article className="prose prose-invert max-w-none 
            prose-headings:font-mono prose-headings:text-text-1
            prose-p:text-text-2 prose-p:leading-relaxed
            prose-code:text-accent prose-code:bg-bg-raised prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-bg-raised prose-pre:border prose-pre:border-border-main">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-text-2">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
