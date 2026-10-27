import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getProjectsList } from "@/features/projects/queries";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await assertPageAccess("projects");
  const projects = await getProjectsList();

  return <ProjectsClient initialProjects={projects} />;
}
