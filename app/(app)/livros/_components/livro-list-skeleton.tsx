export function LivroListSkeleton() {
  return (
    <div className="divide-y divide-gray-100" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-16 items-center gap-3 px-4 py-2">
          <div className="h-14 w-10 flex-shrink-0 animate-pulse rounded bg-gray-200" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
