export const ADMIN_ROLES = [
  "super_admin",
  "treasurer",
  "secretary",
  "project_manager",
] as const;

export type AppRole =
  | "super_admin"
  | "treasurer"
  | "secretary"
  | "project_manager"
  | "member";

export type Permission =
  | "view_admin"
  | "view_finances"
  | "manage_finances"
  | "manage_loans"
  | "manage_members"
  | "invite_members"
  | "invite_admins"
  | "manage_roles"
  | "manage_settings"
  | "manage_content"
  | "manage_documents"
  | "view_reports"
  | "manage_schedule";

/** Which roles grant each permission. super_admin holds everything. */
export const PERMISSION_MATRIX: Record<Permission, AppRole[]> = {
  view_admin: ["super_admin", "treasurer", "secretary", "project_manager"],
  view_finances: ["super_admin", "treasurer", "secretary", "project_manager"],
  manage_finances: ["super_admin", "treasurer"],
  manage_loans: ["super_admin", "treasurer"],
  manage_members: ["super_admin", "secretary"],
  invite_members: ["super_admin", "secretary"],
  invite_admins: ["super_admin"],
  manage_roles: ["super_admin"],
  manage_settings: ["super_admin"],
  manage_content: ["super_admin", "secretary", "project_manager"],
  manage_documents: ["super_admin", "secretary"],
  view_reports: ["super_admin", "treasurer", "secretary", "project_manager"],
  manage_schedule: ["super_admin"],
};

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  treasurer: "Treasurer",
  secretary: "Secretary",
  project_manager: "Project manager",
  member: "Member",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  view_admin: "Open the admin area",
  view_finances: "View ledger & balances",
  manage_finances: "Add / edit ledger entries",
  manage_loans: "Approve & disburse loans",
  manage_members: "Add, edit & approve members",
  invite_members: "Invite members / issue logins",
  invite_admins: "Invite admin users",
  manage_roles: "Assign & revoke roles",
  manage_settings: "Edit site settings",
  manage_content: "Notices & photo gallery",
  manage_documents: "Upload group documents",
  view_reports: "View & export reports",
  manage_schedule: "Configure report schedule",
};

export function canWithRoles(roles: string[], permission: Permission): boolean {
  const allowed = PERMISSION_MATRIX[permission] as readonly string[];
  return roles.some((r) => allowed.includes(r));
}
