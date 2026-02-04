import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getErrorMessage } from "../../util/getErrorMessage";

import { fetchAdminInvestments } from "../../api/admin.investments";
import { UpdateValuationModal } from "../../components/admincomponents/UpdateValuationModal";
import { Investment } from "../../types/investment";

const AdminInvestments = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [isValuationModalOpen, setIsValuationModalOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return investments;

    return investments.filter((item) => {
      const property = item.property_title?.toLowerCase() ?? "";
      const location = item.property_location?.toLowerCase() ?? "";
      return property.includes(q) || location.includes(q) || String(item.user_id).includes(q);
    });
  }, [investments, search]);

  const handleOpenValuation = (investment: Investment) => {
    setSelectedInvestment(investment);
    setIsValuationModalOpen(true);
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
          <h2 className="font-bold text-blue-900 text-3xl">Investments</h2>
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
                    <th className="text-left p-4">User ID</th>
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
                      <td className="p-4 text-gray-600">{investment.user_id}</td>
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
                        <button
                          type="button"
                          onClick={() => handleOpenValuation(investment)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Update Valuation
                        </button>
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
    </div>
  );
};

export default AdminInvestments;
