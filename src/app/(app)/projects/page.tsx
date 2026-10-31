import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  redirect("/project-center?kind=SERVICE_PROJECT");
}
