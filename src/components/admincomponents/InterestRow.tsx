// components/InterestRow.tsx
// import { InvestorInterest } from "../../types/investment";
import { InterestActions } from "./InterestActions";
import {StatusBadge} from "../StatusBadge";
import {formatDate} from "../../util/formatDate"
import { InvestorInterest } from "../../types/investment";
interface Props {
  interest: InvestorInterest;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdate?: (updatedInterest: InvestorInterest) => void;
  onDelete?: (deletedId: number) => void;
}

export const InterestRow = ({
  interest,
  isSelected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: Props) => (

  <tr className="border-t border-gray-100 p-4">
    <td className="p-4">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        aria-label={`Select ${interest.name}`}
      />
    </td>
    <td className="p-4 font-medium">{interest.name}</td>

    <td>
      <p>{interest.email}</p>
      <p className="text-xs text-gray-500">{interest.phone}</p>
    </td>

    <td>{interest.property_title}</td>
    <td>{interest.fractions}</td>
    <td className="text-gray-500">{formatDate(interest.updated_at)}</td>

    <td>
      <StatusBadge status={interest.status} />
    </td>

    <td>
      <InterestActions interest={interest} onUpdate={onUpdate} onDelete={onDelete} />
    </td>
  </tr>
);
