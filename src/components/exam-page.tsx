import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PublicPage } from "./site-layout";
import { supabase } from "@/lib/supabase";

export function ExamLanding({ exam, title, blurb }: { exam: "jamb" | "waec"; title: string; blurb: string }) {
  const { data } = useQuery({
    queryKey: ["subjects-public", exam],
    queryFn: async () => (await supabase.from("subjects").select("id,name").eq("exam", exam).order("name")).data ?? [],
  });
  return (
    <PublicPage>
      <section className="bg-hero">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-4xl font-bold md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{blurb}</p>
          <div className="mt-6 flex gap-3">
            <Button size="lg" asChild><Link to="/cbt">Start practising</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/pricing">See plans</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Subjects</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {(data ?? []).map((s) => <span key={s.id} className="rounded-full border border-border bg-card px-4 py-2 text-sm">{s.name}</span>)}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">Every question is clearly labelled as either a genuine past question or an AI practice question, so you always know what you're studying.</p>
      </section>
    </PublicPage>
  );
}
