import React from "react";
import { getProjectsList } from "@/features/projects/queries";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjectsList();

  return <ProjectsClient initialProjects={projects} />;
}
