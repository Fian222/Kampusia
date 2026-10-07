/** Find an enabled option in at most one pass, including an unset/stale cursor. */
export function nextEnabledOption(options: readonly { disabled?: boolean }[], activeIndex: number, direction: 1 | -1) {
  const start = activeIndex >= 0 && activeIndex < options.length ? activeIndex : direction === 1 ? -1 : 0;
  for (let step = 1; step <= options.length; step++) {
    const index = (start + direction * step + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
