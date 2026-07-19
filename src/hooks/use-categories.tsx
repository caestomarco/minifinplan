import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TX_CATEGORIES } from "@/lib/format";

export type Category = { id: string; name: string };

export function useCategories() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
  const names = (q.data ?? []).map((c) => c.name);
  // Merge user categories with defaults so pickers still work if user hasn't added any.
  const options = names.length > 0 ? names : TX_CATEGORIES;
  return { ...q, categories: q.data ?? [], options };
}
