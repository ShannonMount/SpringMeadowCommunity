import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import {
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
  type PermissionResult,
} from "@/server/services/auth/permissions";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const WORKSPACE_ACCESS_PERMISSION = "board.workspace.access";

export const ADMIN_WORKSPACE_UNAVAILABLE_MESSAGE =
  "The admin workspace is temporarily unavailable.";

type AdminNavigationSection = "core" | "operations" | "records" | "settings";

export type AdminWorkspaceNavItem = {
  label: string;
  href: string;
  enabled: boolean;
  currentStatus?: "available" | "planned";
  section?: AdminNavigationSection;
};

type AdminNavigationRegistryItem = {
  label: string;
  href: string;
  section: AdminNavigationSection;
  currentStatus?: "available" | "planned";
  permissionKey?: string;
  anyPermissionKeys?: string[];
};

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "workspace-unavailable"; message: typeof ADMIN_WORKSPACE_UNAVAILABLE_MESSAGE };

export type AdminWorkspaceResult =
  | {
      kind: "workspace";
      workspace: {
        communityId: string;
        communitySlug: string;
        navigationItems: AdminWorkspaceNavItem[];
      };
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "workspace-unavailable"; message: typeof ADMIN_WORKSPACE_UNAVAILABLE_MESSAGE };

const ADMIN_NAVIGATION_REGISTRY: AdminNavigationRegistryItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    section: "core",
    currentStatus: "available",
  },
  {
    label: "Properties",
    href: "/admin/properties",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.properties.manage",
  },
  {
    label: "Users",
    href: "/admin/users",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.users.manage",
  },
  {
    label: "Roles",
    href: "/admin/roles",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.roles.manage",
  },
  {
    label: "Payments",
    href: "/admin/payments",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.payments.manage",
  },
  {
    label: "Assessments",
    href: "/admin/assessments",
    section: "operations",
    currentStatus: "planned",
    permissionKey: "admin.assessments.manage",
  },
  {
    label: "Documents",
    href: "/admin/documents",
    section: "records",
    currentStatus: "available",
    anyPermissionKeys: ["admin.documents.manage", "board.documents.view"],
  },
  {
    label: "Announcements",
    href: "/admin/announcements",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.announcements.manage",
  },
  {
    label: "Events",
    href: "/admin/events",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.events.manage",
  },
  {
    label: "Messages",
    href: "/admin/messages",
    section: "operations",
    currentStatus: "available",
    permissionKey: "admin.messages.manage",
  },
  {
    label: "Compliance Calendar",
    href: "/admin/compliance",
    section: "records",
    currentStatus: "planned",
  },
  {
    label: "Records Requests",
    href: "/admin/records",
    section: "records",
    currentStatus: "planned",
  },
  {
    label: "Audit Logs",
    href: "/admin/audit",
    section: "records",
    currentStatus: "planned",
    permissionKey: "audit.logs.view",
  },
  {
    label: "Monitoring",
    href: "/admin/monitoring",
    section: "operations",
    currentStatus: "available",
    permissionKey: "board.workspace.access",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    section: "settings",
    currentStatus: "available",
    permissionKey: "admin.settings.manage",
  },
];

async function resolveSpringMeadowCommunity(): Promise<CommunityResolution> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", DEFAULT_COMMUNITY_SLUG)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return {
      kind: "workspace-unavailable",
      message: ADMIN_WORKSPACE_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    kind: "resolved",
    communityId: data.id,
    communitySlug: data.slug,
  };
}

function permissionResultToWorkspace(result: PermissionResult): AdminWorkspaceResult | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return null;
}

async function isPermissionAuthorized(communityId: string, permissionKey: string) {
  const result = await hasPermission({ communityId, permissionKey });

  return result.kind === "authorized";
}

async function isNavigationItemEnabled(
  communityId: string,
  item: AdminNavigationRegistryItem,
) {
  if (item.permissionKey) {
    return isPermissionAuthorized(communityId, item.permissionKey);
  }

  if (item.anyPermissionKeys) {
    const results = await Promise.all(
      item.anyPermissionKeys.map((permissionKey) =>
        isPermissionAuthorized(communityId, permissionKey),
      ),
    );

    return results.some(Boolean);
  }

  return item.currentStatus !== "planned";
}

async function buildNavigationItems(communityId: string): Promise<AdminWorkspaceNavItem[]> {
  const items = await Promise.all(
    ADMIN_NAVIGATION_REGISTRY.map(async (item) => ({
      label: item.label,
      href: item.href,
      enabled: await isNavigationItemEnabled(communityId, item),
      currentStatus: item.currentStatus,
      section: item.section,
    })),
  );

  return items;
}

export async function getAdminWorkspaceContext(): Promise<AdminWorkspaceResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const community = await resolveSpringMeadowCommunity();

  if (community.kind !== "resolved") {
    return community;
  }

  const workspacePermission = await hasPermission({
    communityId: community.communityId,
    permissionKey: WORKSPACE_ACCESS_PERMISSION,
  });
  const permissionResult = permissionResultToWorkspace(workspacePermission);

  if (permissionResult) {
    return permissionResult;
  }

  return {
    kind: "workspace",
    workspace: {
      communityId: community.communityId,
      communitySlug: community.communitySlug,
      navigationItems: await buildNavigationItems(community.communityId),
    },
  };
}
