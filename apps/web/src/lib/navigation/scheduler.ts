type SchedulerOptions = {
  currentHref: () => string;
  targetHref: () => string;
  navigate: (href: string) => Promise<void>;
  debounce?: number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (handle: unknown) => void;
};

export function createNavigationScheduler(options: SchedulerOptions) {
  const delay = options.debounce ?? 320;
  const schedule = options.schedule ?? ((callback, milliseconds) => setTimeout(callback, milliseconds));
  const cancel = options.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown;

  const cancelDebounce = () => {
    if (timer === undefined) return;
    cancel(timer);
    timer = undefined;
  };
  const run = async () => {
    const href = options.targetHref();
    if (href === options.currentHref()) return false;
    try {
      await options.navigate(href);
      return true;
    } catch {
      return false;
    }
  };

  return {
    debounce() {
      cancelDebounce();
      timer = schedule(() => {
        timer = undefined;
        void run();
      }, delay);
    },
    immediate() {
      cancelDebounce();
      return run();
    },
    destroy: cancelDebounce,
  };
}
