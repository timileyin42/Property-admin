import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getErrorMessage } from "../../util/getErrorMessage";

import { fetchAdminInvestments } from "../../api/admin.investments";
import { fetchAdminUsers } from "../../api/admin.users.api";
import DashboardStats from "../../components/admincomponents/DashboardStats";
import { UpdateValuationModal } from "../../components/admincomponents/UpdateValuationModal";
import { ReduceFractionsModal } from "../../components/admincomponents/ReduceFractionsModal";
import { Investment } from "../../types/investment";
import { AdminUser } from "../../types/user";

const AdminInvestments = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [isValuationModalOpen, setIsValuationModalOpen] = useState(false);
  const [isReduceModalOpen, setIsReduceModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [usersById, setUsersById] = useState<Record<number, AdminUser>>({});

  const loadInvestments = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminInvestments();
      setInvestments(data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load investments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, []);

  useEffect(() => {
    fetchAdminUsers({ page: 1, page_size: 500 })
      .then((users) => {
        const map: Record<number, AdminUser> = {};
        users.forEach((user) => {
          map[user.id] = user;
        });
        setUsersById(map);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error, "Failed to load users"));
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return investments;

    return investments.filter((item) => {
      const property = item.property_title?.toLowerCase() ?? "";
      const location = item.property_location?.toLowerCase() ?? "";
      const userName = usersById[item.user_id]?.full_name?.toLowerCase() ?? "";
      return (
        property.includes(q) ||
        location.includes(q) ||
        userName.includes(q) ||
        String(item.user_id).includes(q)
      );
    });
  }, [investments, search, usersById]);

  const handleOpenValuation = (investment: Investment) => {
    setSelectedInvestment(investment);
    setIsValuationModalOpen(true);
  };

  const handleOpenReduce = (investment: Investment) => {
    setSelectedInvestment(investment);
    setIsReduceModalOpen(true);
  };

  const handleValuationUpdate = (updatedInvestment: Investment) => {
    setInvestments((prev) =>
      prev.map((item) =>
        item.id === updatedInvestment.id ? updatedInvestment : item
      )
    );
  };

  return (
    <div className="mx-auto px-4">
      <Toaster position="top-right" />
      <section>
        <div className="pt-6 mb-8">
          <h2 className="font-bold text-blue-900 text-3xl">Admin Dashboard</h2>
          <p className="text-gray-400 text-sm">
            Manage properties, users, and investment interests
          </p>
        </div>

        <DashboardStats />
      </section>

      <section className="mt-10">
        <div className="mb-6">
          <h2 className="font-semibold text-blue-900 text-2xl">Investments</h2>
          <p className="text-gray-400 text-sm">
            Update valuation for investor holdings
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property, location, or user ID"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-1/2"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading investments...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No investments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-4">Property</th>
                    <th className="text-left p-4">Investor</th>
                    <th className="text-right p-4">Fractions</th>
                    <th className="text-right p-4">Initial Value</th>
                    <th className="text-right p-4">Current Value</th>
                    <th className="text-right p-4">Updated</th>
                    <th className="text-right p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((investment) => (
                    <tr key={investment.id} className="border-b last:border-b-0">
                      <td className="p-4">
                        <p className="font-medium text-gray-900">
                          {investment.property_title ?? "-"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {investment.property_location ?? "-"}
                        </p>
                      </td>
                      <td className="p-4 text-gray-600">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {usersById[investment.user_id]?.full_name ?? `User ${investment.user_id}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            ID {investment.user_id}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        {investment.fractions_owned ?? "-"}
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        ₦{investment.initial_value?.toLocaleString() ?? "-"}
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        ₦{investment.current_value?.toLocaleString() ?? "-"}
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        {investment.updated_at
                          ? new Date(investment.updated_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((prev) =>
                                prev === investment.id ? null : investment.id
                              )
                            }
                            className="px-2 text-xl font-bold text-gray-700"
                            aria-label="Investment actions"
                          >
                            ⋮
                          </button>
                          {openMenuId === investment.id && (
                            <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenValuation(investment);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                Update Valuation
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenReduce(investment);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-gray-50"
                              >
                                Reduce Fractions
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <UpdateValuationModal
        isOpen={isValuationModalOpen}
        onClose={() => setIsValuationModalOpen(false)}
        investment={selectedInvestment}
        onUpdate={handleValuationUpdate}
      />
      <ReduceFractionsModal
        isOpen={isReduceModalOpen}
        onClose={() => setIsReduceModalOpen(false)}
        investment={selectedInvestment}
        onUpdate={handleValuationUpdate}
      />
    </div>
  );
};

export default AdminInvestments;
