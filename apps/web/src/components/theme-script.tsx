/**
 * Server-side anti-flash theme script. Runs before hydration so the correct
 * `light`/`dark` class is on `<html>` before React paints. Kept as a server
 * component so React 19 does not warn about a `<script>` inside a client
 * component tree.
 */
export function ThemeScript() {
  const script = `
    (function () {
      try {
        const theme = localStorage.getItem('theme') || 'system';
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
        const html = document.documentElement;
        html.classList.remove('light', 'dark');
        html.classList.add(resolved);
        html.style.colorScheme = resolved;
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
