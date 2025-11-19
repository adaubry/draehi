import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceIndexPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  // Redirect to /contents by default
  redirect(`/${workspaceSlug}/contents`);
}
