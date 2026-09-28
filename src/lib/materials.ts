import { authHeader } from "./supabase";

export async function generateStudySet(materialId: string) {
  const res = await fetch("/api/materials/generate", {
    method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ materialId }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(b.error ?? "Couldn't generate study material");
}
