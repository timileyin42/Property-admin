// src/features/admin/users/useUsers.ts
import { useCallback, useEffect, useState } from "react";
import { fetchAdminUsers } from "../../../api/admin.users.api";
import { AdminUser } from "../../../types/user";
import { getErrorMessage } from "../../../util/getErrorMessage";

export const useUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAdminUsers();

      setUsers(res);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return { users, loading, error, reload: loadUsers };
};
