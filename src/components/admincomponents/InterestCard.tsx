// components/InterestCard.tsx
import { StatusBadge } from "../StatusBadge";
import { InterestActions } from "./InterestActions";
import { InvestorInterest } from "../../types/investment";


interface Props {
  interest: InvestorInterest;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onUpdate?: (updatedInterest: InvestorInterest) => void;
  onDelete?: (deletedId: number) => void;
}
export const InterestCard: React.FC<Props> = ({
  interest,
  isSelected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: Props) =>{


return(
  <div className="bg-white p-4 rounded-xl shadow flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(isSelected)}
          onChange={onToggleSelect}
          aria-label={`Select ${interest.name}`}
        />
        <h4 className="font-semibold">{interest.name}</h4>
      </div>
      <InterestActions interest={interest} onUpdate={onUpdate} onDelete={onDelete} />
    </div>



    <div className="text-sm">
      <p>{interest.email}</p>
      <p className="text-gray-500">{interest.phone}</p>
    </div>

    <div className="flex justify-between items-center">
      <span>Fractions: {interest.fractions ?? "-"}</span>
      <StatusBadge status={interest.status} />
    </div>
  </div>
)};
