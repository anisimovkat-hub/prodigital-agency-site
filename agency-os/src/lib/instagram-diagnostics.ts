export type InstagramPermission = {
  permission: string;
  status: string;
};

const CORE_INSTAGRAM_PERMISSIONS = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
] as const;

export function compactInstagramErrors(items: string[], limit = 2): string {
  const unique = [...new Set(items)];
  const visible = unique.slice(0, limit);
  const suffix = unique.length > limit ? `; ещё ${unique.length - limit}` : "";
  return `${visible.join("; ")}${suffix}`;
}

export function instagramPermissionHint(
  permissions: InstagramPermission[],
): string | null {
  if (!permissions.length) return null;
  const granted = new Set(
    permissions
      .filter((permission) => permission.status === "granted")
      .map((permission) => permission.permission),
  );
  const missingCore = CORE_INSTAGRAM_PERMISSIONS.filter(
    (permission) => !granted.has(permission),
  );
  const hasDiscoveryPermission =
    granted.has("pages_show_list") || granted.has("business_management");
  const parts: string[] = [];
  if (missingCore.length) parts.push(`нет прав: ${missingCore.join(", ")}`);
  if (!hasDiscoveryPermission) {
    parts.push("для поиска аккаунтов нужен pages_show_list или business_management");
  }
  return parts.length ? parts.join("; ") : null;
}
