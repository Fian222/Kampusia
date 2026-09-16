<script lang="ts">
  export type IconName = 'home' | 'clipboard' | 'building' | 'graduation' | 'users' | 'user' | 'book' | 'layers' | 'calendar' | 'presentation' | 'door' | 'clock' | 'chart' | 'menu' | 'close' | 'chevron-down' | 'logout' | 'arrow-right' | 'search' | 'plus' | 'check' | 'info' | 'alert' | 'sparkles';
  let { name, size = 20, strokeWidth = 1.8, class: className = '' }: { name: IconName; size?: number; strokeWidth?: number; class?: string } = $props();
</script>

<svg class={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'home'}<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
  {:else if name === 'clipboard'}<rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 10h6m-6 4h6m-6 4h4" />
  {:else if name === 'building'}<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6" />
  {:else if name === 'graduation'}<path d="m2 9 10-5 10 5-10 5Z" /><path d="M6 11.5V16c3 3 9 3 12 0v-4.5M22 9v6" />
  {:else if name === 'users'}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  {:else if name === 'user'}<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
  {:else if name === 'book'}<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z" /><path d="M4 6.5v13M8 8h8" />
  {:else if name === 'layers'}<path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  {:else if name === 'calendar'}<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  {:else if name === 'presentation'}<rect x="3" y="3" width="18" height="14" rx="2" /><path d="m8 21 4-4 4 4M8 12l2-2 2 1 4-4" />
  {:else if name === 'door'}<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M10 12h.01" />
  {:else if name === 'clock'}<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  {:else if name === 'chart'}<path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
  {:else if name === 'menu'}<path d="M4 7h16M4 12h16M4 17h16" />
  {:else if name === 'close'}<path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'chevron-down'}<path d="m6 9 6 6 6-6" />
  {:else if name === 'logout'}<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
  {:else if name === 'arrow-right'}<path d="M5 12h14m-6-6 6 6-6 6" />
  {:else if name === 'search'}<circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
  {:else if name === 'check'}<path d="m5 12 4 4L19 6" />
  {:else if name === 'info'}<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
  {:else if name === 'alert'}<path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
  {:else}<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />{/if}
</svg>
