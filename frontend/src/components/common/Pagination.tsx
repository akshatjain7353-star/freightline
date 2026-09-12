interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  if (totalCount === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(totalCount, (page + 1) * pageSize);
  const hasPrevious = page > 0;
  const hasNext = to < totalCount;

  return (
    <div className="flex items-center justify-between px-1 py-2 text-xs text-secondary">
      <span>
        Showing {from}-{to} of {totalCount}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious}
          className="px-2.5 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-border"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="px-2.5 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-border"
        >
          Next
        </button>
      </div>
    </div>
  );
}
