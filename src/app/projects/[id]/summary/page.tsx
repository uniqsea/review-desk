import { ProjectSummaryPage } from "@/components/workbench/project-summary-page";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectSummaryPage projectId={id} />;
}
