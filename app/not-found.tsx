import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <SearchX className="mb-3 h-8 w-8 text-neutral-500" aria-hidden />
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-neutral-400">That page, run or link does not exist, or it was deleted or revoked.</p>
      <Link href="/" className="mt-5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">Back to dashboard</Link>
    </div>
  );
}
