export function paginationRange(page: number, limit: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const outOfRange = page > pages;
  return {
    pages,
    outOfRange,
    start: total === 0 || outOfRange ? 0 : (page - 1) * limit + 1,
    end: outOfRange ? 0 : Math.min(page * limit, total),
    previous: Math.min(page - 1, pages),
  };
}
