// src/api/admin.interests.ts
import { InvestorInterest } from "../types/investment";
import { api } from "./axios";

// -----------------------------
// API functions
// -----------------------------
export type InquiryUserType = "all" | "public" | "authenticated";

export interface BulkDeleteResponse {
  deleted_count: number;
  missing_ids: number[];
}

const fetchAdminInquiries = async (
  userType: InquiryUserType = "all"
): Promise<InvestorInterest[]> => {
  const res = await api.get("/admin/inquiries", {
    params: userType === "all" ? undefined : { user_type: userType },
  });

  const interests = res?.data?.inquiries;

  if (!Array.isArray(interests)) {
    console.warn("Unexpected inquiries response:", res.data);
    return [];
  }

  return interests;
};

export const fetchInvestorInterests = async (): Promise<InvestorInterest[]> =>
  fetchAdminInquiries("authenticated");

export const fetchNonAuthenticatedInterests = async (): Promise<InvestorInterest[]> =>
  fetchAdminInquiries("public");


// Update interest function
export const updateInvestorInterest = async (
  interestId: number,
  data: {
    status: string;
    assigned_admin_id?: number;
    notes?: string;
  }
) => {
  console.log(interestId);
  console.log(data);
  const response = await api.patch(`/admin/inquiries/${interestId}`, data);
  return response.data;
};




// Optional: Add update function if needed
export const deleteInquiry = async (inquiryId: number) => {
  const response = await api.delete(`/admin/inquiries/${inquiryId}`);
  return response.data;
};

export const deleteInquiriesBulk = async (ids: number[]): Promise<BulkDeleteResponse> => {
  const response = await api.delete("/admin/inquiries", { data: { ids } });
  return response.data;
};

// export const approveInterest = async (id: number): Promise<void> => {
//   await adminApi.patch(`/admin/interests/${id}`);
// };

// export const rejectInterest = async (id: number): Promise<void> => {
//   await adminApi.patch(`/admin/interests/${id}`);
// };

// export const deleteInterest = async (id: number): Promise<void> => {
//   await adminApi.delete(`/admin/interests/${id}`);
// };





// import { api } from "../api/axios";
// import {  InvestorInterest } from "../types/user";



// export const fetchInvestorInterests = async (): Promise<InvestorInterest[]> => {
//   const { data } = await api.get("/admin/interests");
//   return data.interests;
// };

// export const approveInterest = async (id: number) => {
//   await api.patch(`/admin/interests/${id}/approve`);
// };

// export const rejectInterest = async (id: number) => {
//   await api.patch(`/admin/interests/${id}/reject`);
// };

// export const deleteInterest = async (id: number) => {
//   await api.delete(`/admin/interests/${id}`);
// };