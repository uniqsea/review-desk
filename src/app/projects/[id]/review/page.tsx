import { WorkbenchPage } from "@/components/workbench/workbench-page";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkbenchPage initialProjectId={id} />;
}
