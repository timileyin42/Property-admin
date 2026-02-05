// components/PropertyActions.tsx
import { useState } from "react";
// import {fetchProperties} from "../api/properties"

interface Props {
  onDelete: () => void;
}

export const PropertyActions = ({ onDelete }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded hover:bg-gray-100"
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-32 bg-white shadow-lg rounded border z-10">
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
