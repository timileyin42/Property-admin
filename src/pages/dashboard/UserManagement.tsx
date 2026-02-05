
import { useEffect, useMemo, useState} from "react";
// import { LuLogOut } from "react-icons/lu";
import toast, {Toaster} from "react-hot-toast"
// import type { PortfolioStat } from "../types/dashboard";
// import {ShieldIcon, TrendUpIcon, UsersIcon} from "../components/svgs/ShieldIcon"


// import AvailableProperties from "../investorsData/AvailableProperties";
// import {fetchAdminUsers} from "../../api/fetchAdminUsers"
import {UsersTable} from "../../components/admincomponents/usersTable/UserTable"
import { deleteUsersBulk } from "../../api/admin.users.api";
import { getErrorMessage } from "../../util/getErrorMessage";
import { useUsers } from "../../components/features/users/useUsers";
import { useDashboard } from "../../context/useDashboard";

// interface AdminUser {
//   id: number;
//   email: string;
//   role: "ADMIN" | "INVESTOR";
//   isActive: boolean;
//   created_at: string;
// }

const UserManagement = () => {
  // search and filter function
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "ALL" | "ADMIN" | "INVESTOR" | "PUBLIC" | "USER"
  >("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);

  const roleParam = roleFilter === "ALL" ? undefined : roleFilter.toLowerCase();
  const { users, loading, error, reload } = useUsers({
    page: 1,
    page_size: 50,
    role: roleParam,
  });
  const { stats, loading: statsLoading } = useDashboard();


  // const [properties, setProperties] = useState<Property[]>([]);
  // const [loadingProperties, setLoadingProperties] = useState(true);

const filteredUsers = useMemo(() => {
  if (!Array.isArray(users)) return [];

  return users.filter((user) => {
    const searchValue = search.toLowerCase();

    const matchesSearch =
      user.email.toLowerCase().includes(searchValue) ||
      user.full_name?.toLowerCase().includes(searchValue) ||
      user.phone?.includes(searchValue);

    return matchesSearch;
  });
}, [users, search]);

  const allUsersSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id));
  const someUsersSelected =
    filteredUsers.some((user) => selectedUserIds.includes(user.id)) && !allUsersSelected;

  const toggleUserSelection = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const toggleUserSelectAll = () => {
    if (allUsersSelected) {
      setSelectedUserIds([]);
      return;
    }
    setSelectedUserIds(filteredUsers.map((user) => user.id));
  };

  const handleBulkDelete = () => {
    if (selectedUserIds.length === 0) return;
    setDeleteTargetIds(selectedUserIds);
  };

  const handleCancelDelete = () => {
    setDeleteTargetIds([]);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetIds.length === 0) return;
    try {
      setIsDeleting(true);
      const result = await deleteUsersBulk(deleteTargetIds);
      toast.success(`Deleted ${result.deleted_count} users`);
      if (result.missing_ids.length > 0) {
        toast.error(`Missing users: ${result.missing_ids.join(", ")}`);
      }
      setSelectedUserIds([]);
      setDeleteTargetIds([]);
      reload();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete users"));
    } finally {
      setIsDeleting(false);
    }
  };

// fetching users details 

 useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (loading) return <p>Loading users...</p>;
  return (
    <div className="mx-auto px-4">
     <Toaster />
      <section>
        <div className="pt-6 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-blue-900 text-3xl">
              User Management
            </h2>
            <p className="text-gray-400 text-sm">
              Review and manage platform users
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm w-full sm:w-auto">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-semibold text-blue-900">
              {statsLoading
                ? "..."
                : stats.find((item) => item.title === "Total Users")?.value ?? "-"}
            </p>
          </div>
        </div>
      </section>
        {/* ===== GRAPH SECTION (Placeholder) ===== */}
      <section className="my-12 border border-gray-300  rounded-xl">

<div className="flex flex-col md:flex-row gap-4 mb-4">
  {/* Search */}
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Search by name, email or phone"
    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/2"
  />

  {/* Role Filter */}
  <select
    value={roleFilter}
    onChange={(e) =>
      setRoleFilter(e.target.value as typeof roleFilter)
    }
    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/4"
  >
    <option value="ALL">All Roles</option>
    <option value="ADMIN">Admin</option>
    <option value="USER">User</option>
    <option value="INVESTOR">Investor</option>
    <option value="PUBLIC">Public</option>
  </select>
</div>

{selectedUserIds.length > 0 && (
  <div className="flex justify-end mb-4">
    <button
      type="button"
      onClick={handleBulkDelete}
      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
      disabled={isDeleting}
    >
      Delete selected ({selectedUserIds.length})
    </button>
  </div>
)}

        <UsersTable
          users={filteredUsers}
          onRefresh={reload}
          selectedIds={selectedUserIds}
          allSelected={allUsersSelected}
          someSelected={someUsersSelected}
          onToggleSelect={toggleUserSelection}
          onToggleSelectAll={toggleUserSelectAll}
        />
      </section>

      {/* ===== AVAILABLE PROPERTIES / STATS ===== */}

      
      {deleteTargetIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">
                Delete users
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete {deleteTargetIds.length} users? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
