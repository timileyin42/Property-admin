import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage } from "../../util/getErrorMessage";
import { Investment } from "../../types/investment";
import { reduceInvestmentFractions } from "../../api/admin.investments";

interface ReduceFractionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment: Investment | null;
  onUpdate: (updated: Investment) => void;
}

export const ReduceFractionsModal = ({
  isOpen,
  onClose,
  investment,
  onUpdate,
}: ReduceFractionsModalProps) => {
  const [fractionsToRemove, setFractionsToRemove] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!investment) return;
    setFractionsToRemove("");
    setErrorMessage(null);
  }, [investment]);

  if (!isOpen || !investment) return null;

  const parsedValue = Number(fractionsToRemove);
  const isInvalid =
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    !Number.isInteger(parsedValue);
  const exceedsOwned =
    Number.isFinite(parsedValue) && parsedValue > investment.fractions_owned;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isInvalid) {
      setErrorMessage("Enter a positive whole number.");
      return;
    }

    if (exceedsOwned) {
      setErrorMessage("Fractions to remove cannot exceed fractions owned.");
      return;
    }

    setLoading(true);
    try {
      const result = await reduceInvestmentFractions(
        investment.id,
        parsedValue
      );
      const updatedInvestment = {
        ...investment,
        ...(result?.investment ?? result ?? {}),
      } as Investment;

      onUpdate(updatedInvestment);
      toast.success("Fractions reduced successfully");
      onClose();
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to reduce fractions");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Reduce Investment Fractions</h3>
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
            <p className="text-xs text-gray-500">
              Fractions owned: {investment.fractions_owned}
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Warning</p>
            <p>
              This action permanently reduces the investor&apos;s holdings and
              updates ownership percentage. Confirm before proceeding.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fractions to remove
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={fractionsToRemove}
                onChange={(e) => setFractionsToRemove(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter number of fractions"
                disabled={loading}
              />
              {errorMessage && (
                <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
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
                disabled={loading || isInvalid || exceedsOwned}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Saving..." : "Reduce Fractions"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
