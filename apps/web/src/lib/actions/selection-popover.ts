/** Shared top-layer positioning for fixed selects and searchable references. */
export function selectionPopover(node: HTMLElement, anchor: () => HTMLElement | undefined) {
  const gap = 6;
  const viewportPadding = 12;
  const maximumHeight = 360;
  const position = () => {
    const trigger = anchor();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const topEdge = viewport?.offsetTop ?? 0;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);
    const below = Math.max(0, bottomEdge - rect.bottom - gap - viewportPadding);
    const above = Math.max(0, rect.top - topEdge - gap - viewportPadding);
    const width = Math.min(rect.width, window.innerWidth - 24);
    Object.assign(node.style, {
      left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
      width: `${width}px`, maxHeight: `${Math.min(maximumHeight, Math.max(below, above))}px`,
    });
    // A short list must be positioned by its rendered height, not its height limit.
    const opensBelow = below >= node.getBoundingClientRect().height || below >= above;
    node.style.maxHeight = `${Math.min(maximumHeight, opensBelow ? below : above)}px`;
    const height = node.getBoundingClientRect().height;
    node.style.top = `${opensBelow ? rect.bottom + gap : Math.max(topEdge + viewportPadding, rect.top - height - gap)}px`;
  };
  if (typeof node.showPopover === 'function') node.showPopover();
  position();
  // Lookup, loading and pagination can change the popup height while it is open.
  const observer = new ResizeObserver(position);
  observer.observe(node);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  return { destroy() {
    observer.disconnect();
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    window.visualViewport?.removeEventListener('resize', position);
    window.visualViewport?.removeEventListener('scroll', position);
    if (typeof node.hidePopover === 'function' && node.matches(':popover-open')) node.hidePopover();
  } };
}
