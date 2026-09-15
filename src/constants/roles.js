// Platform-level and tenant-level roles.
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES_AGENT: 'sales_agent',
  SUPPORT_AGENT: 'support_agent',
  VIEWER: 'viewer',
}

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.OWNER]: 'Business Owner',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.SALES_AGENT]: 'Sales Agent',
  [ROLES.SUPPORT_AGENT]: 'Support Agent',
  [ROLES.VIEWER]: 'Viewer',
}

// Roles a business owner can assign to teammates (excludes platform-level role).
export const TENANT_ROLES = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SALES_AGENT,
  ROLES.SUPPORT_AGENT,
  ROLES.VIEWER,
]
