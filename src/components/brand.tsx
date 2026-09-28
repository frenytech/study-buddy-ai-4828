import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export function Logo({ to = "/" }: { to?: "/" | "/dashboard" }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <GraduationCap className="h-5 w-5" />
      </span>
      <span>Study<span className="text-primary">AI</span></span>
    </Link>
  );
}
