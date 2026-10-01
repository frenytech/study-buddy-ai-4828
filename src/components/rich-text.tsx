import { Fragment, type ReactNode } from "react";

/** Minimal, safe markdown: # headings, - bullets, 1. lists, **bold**, *italic*, [links](https://...). No raw HTML. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      out.push(<a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{label}</a>);
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  if (!text?.trim()) return null;
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>{list.items.map((i, n) => <li key={n}>{inline(i)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const b = line.match(/^\s*[-*]\s+(.*)/); const o = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (b || o) {
      const ordered = !!o;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((b ?? o)![1]!); continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const cls = h[1]!.length === 1 ? "text-xl font-bold" : h[1]!.length === 2 ? "text-lg font-semibold" : "font-semibold";
      blocks.push(<p key={blocks.length} className={`${cls} mt-2`}>{inline(h[2]!)}</p>);
    } else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className={`space-y-3 text-sm leading-relaxed ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
