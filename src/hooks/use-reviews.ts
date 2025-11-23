import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface Review {
  id: string;
  appointment_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  organization_id: string;
}

export function useReviews() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading: loading } = useQuery({
    queryKey: ["reviews", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("organization_id", profile.organization_id);

      if (error) throw error;
      return data as Review[];
    },
    enabled: !!profile?.organization_id,
  });

  const addReviewMutation = useMutation({
    mutationFn: async (review: Omit<Review, "id" | "created_at" | "organization_id">) => {
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          ...review,
          organization_id: profile?.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", profile?.organization_id] });
      queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] }); // Also invalidate appointments to show updated status
    },
  });

  const averageRating = reviews.length
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0;

  return {
    reviews,
    loading,
    addReview: (review: Omit<Review, "id" | "created_at" | "organization_id">) => addReviewMutation.mutateAsync(review),
    averageRating,
    totalReviews: reviews.length,
  };
}
