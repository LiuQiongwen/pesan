export const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
export const INTER = "'Inter',system-ui,sans-serif";

export const STATUS_COLOR: Record<string, string> = {
  pending:   '#ffa040',
  submitted: '#66f0ff',
  paid:      '#00e5c8',
  fulfilled: '#b496ff',
  rejected:  '#ff4466',
  expired:   '#555870',
};

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
