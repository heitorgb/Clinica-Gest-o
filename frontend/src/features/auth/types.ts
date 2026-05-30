export type Permission = {
  id: string;
  name: string;
  description: string | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  roles: Role[];
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};
