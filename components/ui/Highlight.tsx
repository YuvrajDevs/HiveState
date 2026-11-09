/** Highlights case-insensitive matches of `query` in `text`. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const hit = lower.indexOf(needle, i);
    if (hit === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(<mark key={k++} className="rounded-sm bg-yellow-400/30 text-inherit">{text.slice(hit, hit + q.length)}</mark>);
    i = hit + q.length;
  }
  return <>{parts}</>;
}
