import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getProjectsList } from "@/features/projects/queries";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

interface ProjectsPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const context = await assertPageAccess("projects");
  const projects = await getProjectsList();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const canCreate = context.isPlatformAdmin || context.permissions.has("PROJECT_CREATE");

  return (
    <ProjectsClient
      initialProjects={projects}
      canCreate={canCreate}
      initialAction={resolvedSearchParams.action}
    />
  );
}
