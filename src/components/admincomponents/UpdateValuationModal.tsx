import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage } from "../../util/getErrorMessage";
import { Investment } from "../../types/investment";
import { updateInvestmentValuation } from "../../api/admin.investments";

interface UpdateValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment: Investment | null;
  onUpdate: (updated: Investment) => void;
}

export const UpdateValuationModal = ({
  isOpen,
  onClose,
  investment,
  onUpdate,
}: UpdateValuationModalProps) => {
  const [currentValue, setCurrentValue] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!investment) return;
    setCurrentValue(
      investment.current_value !== undefined && investment.current_value !== null
        ? String(investment.current_value)
        : ""
    );
  }, [investment]);

  if (!isOpen || !investment) return null;

  const parsedValue = Number(currentValue);
  const isInvalid = Number.isNaN(parsedValue) || parsedValue < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInvalid) {
      toast.error("Enter a valid non-negative value");
      return;
    }

    setLoading(true);
    try {
      const result = await updateInvestmentValuation(investment.id, parsedValue);
      const updatedInvestment = {
        ...investment,
        ...(result?.investment ?? result ?? {}),
        current_value: parsedValue,
      } as Investment;

      onUpdate(updatedInvestment);
      toast.success("Valuation updated");
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update valuation"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Update Valuation</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">{investment.property_title}</p>
            <p className="text-xs text-gray-500">Investment ID: {investment.id}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Value
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current value"
                disabled={loading}
              />
              {isInvalid && currentValue !== "" && (
                <p className="text-xs text-red-500 mt-1">
                  Value must be a non-negative number.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isInvalid}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Saving..." : "Update Valuation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
