// components/PropertyTable.tsx
import { useEffect, useRef } from "react";
// import { useEffect, useState } from "react";
import { ApiProperty } from "../types/property";
// import { fetchProperties } from "../api/properties";
import { PropertyRow } from "./PropertyRow";

interface Props {
  properties: ApiProperty[];
  loading: boolean;
  onDelete: (propertyId: number) => void;
  selectedIds: number[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
}
export const PropertyTable = ({
  properties,
  loading,
  onDelete,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onToggleSelectAll,
}: Props) => {
  const rows = Array.isArray(properties) ? properties : [];
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);
  // const [properties, setProperties] = useState<Property[]>([]);
  // const [loading, setLoading] = useState(true);

  // useEffect(() => {
  //   fetchProperties()
  //     .then(setProperties)
  //     .finally(() => setLoading(false));
  // }, []);

  if (loading) return <p>Loading properties...</p>;

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border-gray-300 p-6 rounded-x mt-6">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left p-4">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="text-left p-4">Property Name</th>
            <th className="text-left">Location</th>
            <th className="text-left">Total Value</th>
            <th className="text-left">Fractions</th>
            <th className="text-left">Date</th>
            <th className="text-left">Status</th>
            <th className="text-left">Action</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {rows.map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              isSelected={selectedIds.includes(property.id)}
              onToggleSelect={() => onToggleSelect(property.id)}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
