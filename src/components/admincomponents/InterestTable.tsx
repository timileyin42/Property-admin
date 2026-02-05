// components/InterestTable.tsx
import { useEffect, useRef } from "react";
import { InvestorInterest } from "../../types/investment";
import { InterestRow } from "./InterestRow";

interface Props {
  data: InvestorInterest[];
  selectedIds: number[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onUpdate?: (updatedInterest: InvestorInterest) => void;
  onDelete?: (deletedId: number) => void;
}

export const InterestTable = ({
  data,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onToggleSelectAll,
  onUpdate,
  onDelete,
}: Props) => {
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="p-4 text-left">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="p-4 text-left">Name</th>
            <th className="text-left">Contact</th>
            <th className="text-left">Property</th>
            <th className="text-left">Fractions</th>
            <th className="text-left">Date</th>
            <th className="text-left">Status</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {data.map((interest) => (
            <InterestRow
              key={interest.id}
              interest={interest}
              isSelected={selectedIds.includes(interest.id)}
              onToggleSelect={() => onToggleSelect(interest.id)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
