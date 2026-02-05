import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import { deleteInquiry, fetchInvestorInterests, fetchNonAuthenticatedInterests } from "../api/admin.interests";
import { InterestCard } from "../components/admincomponents/InterestCard";
import { InterestTable } from "../components/admincomponents/InterestTable";
import { InterestActions } from "../components/admincomponents/InterestActions";
import { InterestStatus, InvestorInterest } from "../types/investment";
import { NonAuthenticatedInterest } from "../types/interest";
import { formatDate } from "../util/formatDate";
import { StatusBadge } from "../components/StatusBadge";
import { getErrorMessage } from "../util/getErrorMessage";

const statusOptions = ["ALL", "NEW", "CONTACTED", "CLOSED"] as const;
const interestStatuses: InterestStatus[] = [
  "NEW",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "SOLD",
  "AVAILABLE",
  "CONTACTED",
  "CLOSED",
];

type StatusFilter = (typeof statusOptions)[number];
type UserTypeFilter = "authenticated" | "nonAuthenticated";

export const InterestPage = () => {
  const [authenticatedData, setAuthenticatedData] = useState<InvestorInterest[]>([]);
  const [nonAuthenticatedData, setNonAuthenticatedData] = useState<NonAuthenticatedInterest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("authenticated");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { id: number; type: "authenticated" | "public" } | null
  >(null);

  useEffect(() => {
    const loadAllInterests = async () => {
      try {
        setLoading(true);
        const [authRes, nonAuthRes] = await Promise.all([
          fetchInvestorInterests(),
          fetchNonAuthenticatedInterests(),
        ]);

        setAuthenticatedData(Array.isArray(authRes) ? authRes : []);
        setNonAuthenticatedData(Array.isArray(nonAuthRes) ? nonAuthRes : []);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to load interests"));
      } finally {
        setLoading(false);
      }
    };

    loadAllInterests();
  }, []);

  const filteredAuthenticatedData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return authenticatedData.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const property = item.property_title?.toLowerCase() ?? "";
      const status = item.status ?? "";

      const matchesSearch = q === "" || name.includes(q) || property.includes(q);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [authenticatedData, search, statusFilter]);

  const filteredNonAuthenticatedData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nonAuthenticatedData.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const email = item.email?.toLowerCase() ?? "";
      const property = item.property_title?.toLowerCase() ?? "";
      const status = item.status ?? "";

      const matchesSearch = q === "" || name.includes(q) || email.includes(q) || property.includes(q);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [nonAuthenticatedData, search, statusFilter]);

  const isAuthenticatedTab = userTypeFilter === "authenticated";
  const currentDataCount = isAuthenticatedTab
    ? filteredAuthenticatedData.length
    : filteredNonAuthenticatedData.length;

  const handleDeleteAuthenticated = (interestId: number) => {
    setDeleteTarget({ id: interestId, type: "authenticated" });
  };

  const handleDeletePublic = (interestId: number) => {
    setDeleteTarget({ id: interestId, type: "public" });
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingId(deleteTarget.id);
      await deleteInquiry(deleteTarget.id);
      if (deleteTarget.type === "authenticated") {
        setAuthenticatedData((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      } else {
        setNonAuthenticatedData((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      }
      toast.success("Inquiry deleted");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete inquiry"));
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const handleUpdateAuthenticated = (updated: InvestorInterest) => {
    setAuthenticatedData((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleUpdatePublic = (updated: InvestorInterest) => {
    setNonAuthenticatedData((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? { ...item, status: updated.status }
          : item
      )
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <p className="text-sm text-gray-500">Loading interests...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Investor Interests</h2>
          <p className="text-sm text-gray-500">
            Review authenticated interests and public inquiries
          </p>
        </div>

        <div className="flex flex-wrap gap-3 md:ml-auto">
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value as UserTypeFilter)}
            className="bg-gray-100 rounded-lg px-3 py-2 text-sm"
          >
            <option value="authenticated">Authenticated interests</option>
            <option value="nonAuthenticated">Public inquiries</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isAuthenticatedTab
                ? "Search by name or property..."
                : "Search by name, email, or property..."
            }
            className="bg-gray-100 rounded-lg px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-gray-100 rounded-lg px-3 py-2 text-sm"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold">{authenticatedData.length}</div>
          <div className="text-sm text-gray-500">Authenticated</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{nonAuthenticatedData.length}</div>
          <div className="text-sm text-gray-500">Unauthenticated</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{authenticatedData.length + nonAuthenticatedData.length}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
      </div>

      {currentDataCount === 0 ? (
        <div className="text-sm text-gray-500">No interests found.</div>
      ) : isAuthenticatedTab ? (
        <>
          <InterestTable
            data={filteredAuthenticatedData}
            onUpdate={handleUpdateAuthenticated}
            onDelete={handleDeleteAuthenticated}
          />
          <div className="grid gap-4 md:hidden">
            {filteredAuthenticatedData.map((interest) => (
              <InterestCard
                key={interest.id}
                interest={interest}
                onUpdate={handleUpdateAuthenticated}
                onDelete={handleDeleteAuthenticated}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 text-left">Name</th>
                  <th className="text-left">Contact</th>
                  <th className="text-left">Property</th>
                  <th className="text-left">Message</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNonAuthenticatedData.map((interest) => (
                  <tr key={interest.id} className="border-t border-gray-100">
                    <td className="p-4 font-medium">{interest.name}</td>
                    <td>
                      <p>{interest.email}</p>
                      <p className="text-xs text-gray-500">{interest.phone}</p>
                    </td>
                    <td>{interest.property_title ?? "-"}</td>
                    <td className="max-w-xs truncate" title={interest.message ?? ""}>
                      {interest.message}
                    </td>
                    <td className="text-gray-500">{formatDate(interest.created_at)}</td>
                    <td>
                      <StatusBadge status={resolveStatus(interest.status)} />
                    </td>
                    <td>
                      <InterestActions
                        interest={toInvestorInterest(interest)}
                        onUpdate={handleUpdatePublic}
                        onDelete={handleDeletePublic}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:hidden">
            {filteredNonAuthenticatedData.map((interest) => (
              <div key={interest.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div>
                  <p className="font-semibold text-blue-900">{interest.name}</p>
                  <p className="text-xs text-gray-500">{interest.email}</p>
                  <p className="text-xs text-gray-500">{interest.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Property</p>
                  <p className="text-sm">{interest.property_title ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Message</p>
                  <p className="text-sm text-gray-600">{interest.message}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatDate(interest.created_at)}</span>
                  <StatusBadge status={resolveStatus(interest.status)} />
                </div>
                <div className="flex justify-end">
                  <InterestActions
                    interest={toInvestorInterest(interest)}
                    onUpdate={handleUpdatePublic}
                    onDelete={handleDeletePublic}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">
                Delete inquiry
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete this inquiry? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={deletingId === deleteTarget.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                  disabled={deletingId === deleteTarget.id}
                >
                  {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const toInvestorInterest = (interest: NonAuthenticatedInterest): InvestorInterest => ({
  id: interest.id,
  name: interest.name,
  email: interest.email,
  phone: interest.phone,
  message: interest.message ?? null,
  property_id: interest.property_id,
  property_title: interest.property_title ?? "",
  fractions: undefined,
  investment_amount: undefined,
  status: resolveStatus(interest.status),
  contacted_at: null,
  assigned_admin_id: null,
  notes: null,
  created_at: interest.created_at,
  updated_at: interest.created_at,
});

const resolveStatus = (status?: string): InterestStatus =>
  interestStatuses.includes(status as InterestStatus)
    ? (status as InterestStatus)
    : "NEW";
