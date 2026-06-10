import { engineGet } from "@/lib/camunda/engine";

import { DeploymentRail, type DeploymentRow } from "./_components/deployment-rail";
import { ResourceDetail, ResourceDetailEmpty } from "./_components/resource-detail";
import { ResourceList, type ResourceRow } from "./_components/resource-list";
import { DeploymentsWorkspace } from "./_components/workspace";

async function safeDeployments(): Promise<{ deployments: DeploymentRow[] | null; error: string | null }> {
  try {
    const deployments = await engineGet<DeploymentRow[]>(
      "/deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=100",
    );
    return { deployments, error: null };
  } catch (err) {
    return {
      deployments: null,
      error: err instanceof Error ? err.message : "Engine unreachable",
    };
  }
}

async function safeResources(deploymentId: string): Promise<{ resources: ResourceRow[] | null; error: string | null }> {
  try {
    const resources = await engineGet<ResourceRow[]>(`/deployment/${encodeURIComponent(deploymentId)}/resources`);
    resources.sort((a, b) => a.name.localeCompare(b.name));
    return { resources, error: null };
  } catch (err) {
    return {
      resources: null,
      error: err instanceof Error ? err.message : "Failed to load resources",
    };
  }
}

export default async function DeploymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ deploymentId?: string; resourceId?: string }>;
}) {
  const { deploymentId: rawDeploymentId, resourceId: rawResourceId } = await searchParams;
  const deploymentId = rawDeploymentId?.trim() || null;
  const resourceId = rawResourceId?.trim() || null;

  const { deployments, error: depError } = await safeDeployments();

  const { resources, error: resError } = deploymentId
    ? await safeResources(deploymentId)
    : { resources: null as ResourceRow[] | null, error: null };

  const showDetail = Boolean(deploymentId && resourceId);

  return (
    <div className="h-[calc(100svh-5rem)] md:h-[calc(100svh-6rem)]">
      <DeploymentsWorkspace
        listSlot={<DeploymentRail deployments={deployments} selectedId={deploymentId} error={depError} />}
        resourcesSlot={
          <ResourceList
            deploymentId={deploymentId}
            resources={resources}
            selectedResourceId={resourceId}
            error={resError}
          />
        }
        detailSlot={
          showDetail && deploymentId && resourceId ? (
            <ResourceDetail deploymentId={deploymentId} resourceId={resourceId} />
          ) : (
            <ResourceDetailEmpty hasDeployment={Boolean(deploymentId)} />
          )
        }
      />
    </div>
  );
}
