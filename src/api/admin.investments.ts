import { api } from "./axios";
import type { Investment } from "../types/investment";

export const fetchAdminInvestments = async (userId?: number): Promise<Investment[]> => {
  const res = await api.get("/admin/investments", {
    params: userId ? { user_id: userId } : undefined,
  });

  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.investments)) return data.investments;

  return [];
};

export const updateInvestmentValuation = async (
  investmentId: number,
  currentValue: number
) => {
  const res = await api.patch(`/admin/investments/${investmentId}/valuation`, {
    current_value: currentValue,
  });
  return res.data;
};
