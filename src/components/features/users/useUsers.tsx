// src/features/admin/users/useUsers.ts
import { useCallback, useEffect, useState } from "react";
import { fetchAdminUsers } from "../../../api/admin.users.api";
import { AdminUser } from "../../../types/user";
import { getErrorMessage } from "../../../util/getErrorMessage";

interface UseUsersParams {
  page?: number;
  page_size?: number;
  role?: string;
}

export const useUsers = (params: UseUsersParams = {}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { page, page_size, role } = params;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAdminUsers({ page, page_size, role });

      setUsers(res);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, [page, page_size, role]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return { users, loading, error, reload: loadUsers };
};
