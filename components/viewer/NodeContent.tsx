// TODO: Consider migrating to shadcn/ui Typography components
"use client";

type NodeContentProps = {
  html: string;
};

export function NodeContent({ html }: NodeContentProps) {
  return (
    <div
      className="
    prose max-w-none

    /* --- Typography (Notion-like) --- */
    prose-headings:font-semibold
    prose-headings:text-[#37352F]
    prose-headings:tracking-tight
    prose-h1:text-4xl prose-h1:mb-4 
    prose-h2:text-3xl prose-h2:mb-3 
    prose-h3:text-2xl prose-h3:mb-2 

    prose-p:text-[#37352F]
    prose-p:leading-7
    prose-p:mb-3

    /* --- Links --- */
    prose-a:text-[#0B6EFB]
    prose-a:no-underline
    hover:prose-a:underline

    /* --- Strong / Emphasis --- */
    prose-strong:font-semibold prose-strong:text-[#37352F]

    /* --- Inline code (Notion style) --- */
    prose-code:bg-[#F1F1EF]
    prose-code:text-[#EB5757]
    prose-code:rounded
    prose-code:px-[4px] prose-code:py-[2px]
    prose-code:font-mono
    prose-code:text-[0.9em]
    prose-code:before:content-[''] prose-code:after:content-['']

    /* --- Code blocks (light, rounded) --- */
    prose-pre:bg-[#F7F6F3] prose-pre:text-[#37352F]
    prose-pre:rounded-lg
    prose-pre:p-4
    prose-pre:border prose-pre:border-[#E5E5E5]
    prose-pre:shadow-sm
    prose-pre:overflow-x-auto

    /* --- Blockquote (Notion style) --- */
    prose-blockquote:border-l-[3px]
    prose-blockquote:border-[#E5E5E5]
    prose-blockquote:text-[#37352F]
    prose-blockquote:pl-4
    prose-blockquote:italic
    prose-blockquote:bg-[#FAFAF9]
    prose-blockquote:py-1 rounded-r-md

    /* --- Lists --- */
    prose-ul:list-disc prose-ul:pl-6
    prose-ol:list-decimal prose-ol:pl-6
    prose-li:my-1

    /* --- Images (Notion style) --- */
    prose-img:rounded-md
    prose-img:shadow-sm

    /* --- Horizontal rules --- */
    prose-hr:border-[#E6E6E6] prose-hr:my-8
  "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
