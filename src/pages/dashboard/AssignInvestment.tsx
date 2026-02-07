import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast, { Toaster } from "react-hot-toast";
import { getErrorMessage } from "../../util/getErrorMessage";
import { api } from "../../api/axios";
import { fetchProperties } from "../../api/properties";
import { ApiProperty } from "../../types/property";
import { AdminUser } from "../../types/user";
import { assignInvestmentSchema, AssignInvestmentValues } from "../../validators/assignInvestment.schema";
import { isVideoUrl } from "../../util/normalizeMediaUrl";
import { usePresignedMediaUrls } from "../../hooks/usePresignedMediaUrls";

const AssignInvestment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userIdParam = searchParams.get("userId");
  const userId = userIdParam ? Number(userIdParam) : NaN;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<ApiProperty | null>(null);
  const [loading, setLoading] = useState(true);

  const allMediaRefs = useMemo(
    () =>
      properties.flatMap((property) =>
        [property.primary_image, ...(property.image_urls ?? [])].filter(Boolean) as string[]
      ),
    [properties]
  );
  const resolvedMedia = usePresignedMediaUrls(allMediaRefs);
  const resolvedMap = useMemo(
    () => new Map(resolvedMedia.map((item) => [item.raw, item.url])),
    [resolvedMedia]
  );

  const resolveMediaUrl = useCallback((value?: string) => {
    if (!value) return "";
    const resolved = resolvedMap.get(value);
    if (resolved) return resolved;
    if (
      value.startsWith("http") ||
      value.startsWith("blob:") ||
      value.startsWith("data:") ||
      value.startsWith("//")
    ) {
      return value;
    }
    return "";
  }, [resolvedMap]);

  const resolver: Resolver<AssignInvestmentValues> =
    zodResolver(assignInvestmentSchema) as Resolver<AssignInvestmentValues>;
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<AssignInvestmentValues>({
    resolver,
    defaultValues: {
      user_id: userId || 0,
      property_id: 0,
      fractions_owned: 1,
      initial_value: 1,
      current_value: 1,
      image_url: "",
    },
  });

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        const [userRes, propertiesRes] = await Promise.all([
          api.get<AdminUser>(`/admin/users/${userId}`),
          fetchProperties(),
        ]);

        setUser(userRes.data);
        setProperties(propertiesRes);
        if (propertiesRes.length > 0) {
          setSelectedProperty((prev) => prev ?? propertiesRes[0]);
        }
      } catch (error) {
        console.error("Failed to load assign investment data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const selectedImageKey = useMemo(() => {
    if (!selectedProperty) return "";
    const candidate = [
      selectedProperty.primary_image,
      ...(selectedProperty.image_urls ?? []),
    ]
      .filter(Boolean)
      .find((url) => !isVideoUrl(url));

    return candidate ?? "";
  }, [selectedProperty]);

  const selectedMediaUrls = useMemo(() => {
    if (!selectedProperty) return [] as string[];
    return [selectedProperty.primary_image, ...(selectedProperty.image_urls ?? [])]
      .map((url) => resolveMediaUrl(url ?? ""))
      .filter(Boolean) as string[];
  }, [selectedProperty, resolveMediaUrl]);

  const fractionsSummary = useMemo(() => {
    if (!selectedProperty) return null;
    return {
      total: selectedProperty.total_fractions ?? 0,
      sold: selectedProperty.fractions_sold ?? 0,
      available: selectedProperty.fractions_available ?? 0,
      status: selectedProperty.status ?? "AVAILABLE",
    };
  }, [selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;
    setValue("property_id", selectedProperty.id);
    setValue("image_url", selectedImageKey);
    setValue("initial_value", selectedProperty.project_value);
    setValue("current_value", selectedProperty.project_value);
  }, [selectedProperty, selectedImageKey, setValue]);

  const onSubmit = async (data: AssignInvestmentValues) => {
    if (selectedProperty && fractionsSummary) {
      if (fractionsSummary.total > 0 && data.fractions_owned > fractionsSummary.available) {
        toast.error("Fractions owned cannot exceed available fractions");
        return;
      }
    }

    try {
      await api.post("/admin/investments", {
        ...data,
        image_url: selectedImageKey,
      });
      toast.success("Investment assigned successfully");
      navigate("/admindashboard/user_management");
    } catch (error: unknown) {
      console.error("Failed to assign investment:", error);
      toast.error(getErrorMessage(error, "Failed to assign investment"));
    }
  };

  if (!userIdParam || Number.isNaN(userId)) {
    return <p className="text-center py-10">Missing user information.</p>;
  }

  if (loading) {
    return <p className="text-center py-10">Loading data...</p>;
  }

  return (
    <div className="mx-auto px-4">
      <Toaster />
      <section>
        <div className="pt-6 mb-8">
          <h2 className="font-bold text-blue-900 text-3xl">
            Assign Investment
          </h2>
          <p className="text-gray-400 text-sm">
            Select a property and assign investment details
          </p>
        </div>

        {user && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Assigning to</p>
            <p className="text-blue-900 font-semibold">{user.full_name}</p>
            <p className="text-gray-500 text-sm">{user.email}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => {
                const mediaUrls = [property.primary_image, ...(property.image_urls ?? [])]
                  .map((url) => resolveMediaUrl(url ?? ""))
                  .filter(Boolean) as string[];
                const imageSrc = mediaUrls.find((url) => !isVideoUrl(url));
                const videoSrc = mediaUrls.find((url) => isVideoUrl(url));
                const isSelected = selectedProperty?.id === property.id;

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => setSelectedProperty(property)}
                    className={`text-left bg-white border rounded-xl shadow-sm overflow-hidden transition ${
                      isSelected ? "border-blue-600" : "border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    <div className="h-40 bg-gray-100">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : videoSrc ? (
                        <video
                          className="w-full h-full object-cover"
                          src={videoSrc}
                          muted
                          playsInline
                          loop
                          autoPlay
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          Image unavailable
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-blue-900 text-sm">
                        {property.title}
                      </h3>
                      <p className="text-gray-500 text-xs mt-1">
                        {property.location}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-semibold text-blue-900">Investment Details</h3>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold">Fractional allocation rules</p>
                <p>
                  Always provide <span className="font-medium">fractions owned</span> for fractional properties.
                  The backend increments <span className="font-medium">fractions sold</span> and automatically marks
                  a property as <span className="font-medium">SOLD</span> once sold reaches total fractions. If the
                  value is missing or exceeds available fractions, the request fails.
                </p>
              </div>

              {fractionsSummary && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Total fractions</span>
                    <span className="font-semibold">{fractionsSummary.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Fractions sold</span>
                    <span className="font-semibold">{fractionsSummary.sold}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Fractions available</span>
                    <span className="font-semibold">{fractionsSummary.available}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="font-semibold">{fractionsSummary.status}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-600">Fractions Owned</label>
                <input
                  type="number"
                  {...register("fractions_owned")}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm"
                />
                <p className="text-red-500 text-xs mt-1">
                  {errors.fractions_owned?.message}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Initial Value</label>
                <input
                  type="number"
                  {...register("initial_value")}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm"
                />
                <p className="text-red-500 text-xs mt-1">
                  {errors.initial_value?.message}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Current Value</label>
                <input
                  type="number"
                  {...register("current_value")}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md p-2 text-sm"
                />
                <p className="text-red-500 text-xs mt-1">
                  {errors.current_value?.message}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600">Media</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {selectedMediaUrls.length > 0 ? (
                    selectedMediaUrls.map((url) => (
                      <div
                        key={url}
                        className="h-24 w-full rounded-md border border-gray-200 bg-gray-50 overflow-hidden"
                      >
                        {isVideoUrl(url) ? (
                          <video
                            className="h-full w-full object-cover"
                            src={url}
                            muted
                            playsInline
                            loop
                          />
                        ) : (
                          <img
                            src={url}
                            alt={selectedProperty?.title ?? "Selected property"}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 h-24 w-full rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                      No media available
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedProperty}
                className="w-full bg-blue-900 text-white rounded-md py-3 text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting ? "Assigning..." : "Assign Property"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AssignInvestment;
