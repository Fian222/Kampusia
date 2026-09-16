type NavigationState = {
  to: { url: URL } | null;
};

export function isListNavigationPending(navigation: NavigationState, pathname: string) {
  return navigation.to?.url.pathname === pathname;
}
