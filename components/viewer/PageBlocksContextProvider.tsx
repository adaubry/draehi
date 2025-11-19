"use client";

import { PageBlocksContext } from "@/lib/page-blocks-context";
import type { Node } from "@/modules/content/schema";

type PageBlocksContextProviderProps = {
  blocks: Node[];
  pageUuid: string;
  children: React.ReactNode;
};

export function PageBlocksContextProvider({
  blocks,
  pageUuid,
  children,
}: PageBlocksContextProviderProps) {
  return (
    <PageBlocksContext.Provider value={{ blocks, pageUuid }}>
      {children}
    </PageBlocksContext.Provider>
  );
}
