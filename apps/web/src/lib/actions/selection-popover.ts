/** Shared top-layer positioning for fixed selects and searchable references. */
export function selectionPopover(node: HTMLElement, anchor: () => HTMLElement | undefined) {
  const position = () => {
    const trigger = anchor();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const topEdge = viewport?.offsetTop ?? 0;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);
    const below = bottomEdge - rect.bottom - 12;
    const above = rect.top - topEdge - 12;
    const height = Math.min(360, Math.max(100, below, above));
    const top = below >= Math.min(360, above) ? rect.bottom + 6 : Math.max(topEdge + 8, rect.top - height - 6);
    const width = Math.min(rect.width, window.innerWidth - 24);
    Object.assign(node.style, {
      left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
      top: `${top}px`, width: `${width}px`, maxHeight: `${height}px`,
    });
  };
  position();
  if (typeof node.showPopover === 'function') node.showPopover();
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  return { destroy() {
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    window.visualViewport?.removeEventListener('resize', position);
    window.visualViewport?.removeEventListener('scroll', position);
    if (typeof node.hidePopover === 'function' && node.matches(':popover-open')) node.hidePopover();
  } };
}
