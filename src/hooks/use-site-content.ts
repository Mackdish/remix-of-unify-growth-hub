import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Public site settings (group name, contacts, about text). */
export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}

/** Admin-managed projects shown on the public site. */
export function usePublicProjects() {
  return useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, status, progress, image_url")
        .order("sort_order")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** First uploaded image in a category, e.g. the hero background. */
export function useSiteImage(category: string) {
  return useQuery({
    queryKey: ["site-image", category],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_images")
        .select("public_url")
        .eq("category", category)
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.public_url ?? null;
    },
    staleTime: 60_000,
  });
}
