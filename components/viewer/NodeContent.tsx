// TODO: Consider migrating to shadcn/ui Typography components
"use client";

type NodeContentProps = {
  html: string;
};

export function NodeContent({ html }: NodeContentProps) {
  return (
    <div
      className="block-content prose prose-gray max-w-none
        prose-headings:font-bold prose-headings:tracking-tight
        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
        prose-p:leading-7 prose-p:text-gray-700
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:font-bold prose-strong:text-gray-900
        prose-em:italic
        prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:overflow-x-auto
        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-700
        prose-ul:list-disc prose-ul:pl-6
        prose-ol:list-decimal prose-ol:pl-6
        prose-li:my-1
        prose-img:rounded-lg prose-img:shadow-md
        prose-hr:border-gray-300
      "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
