/**
 * Server-side anti-flash language script. Runs before hydration so `lang` and
 * `dir` are correct on `<html>` before React paints — the counterpart to
 * `ThemeScript`, which already does this for light/dark.
 *
 * Without it, `<html lang="en">` ships from the server and the language
 * provider corrects it in a `useLayoutEffect`, so an Urdu user gets an
 * English left-to-right first paint that then flips. The storage key must
 * match STORAGE_KEY in `src/lib/language.tsx`.
 *
 * This is a mitigation, not the fix: `useSyncExternalStore`'s server snapshot
 * still returns 'en', so the *content* is English until hydration. Rendering
 * Urdu on the server needs the preference in a cookie.
 *
 * Kept as a server component so React 19 does not warn about a `<script>`
 * inside a client component tree.
 */
export function LanguageScript() {
  const script = `
    (function () {
      try {
        var lang = localStorage.getItem('wakeel-language') === 'ur' ? 'ur' : 'en';
        var html = document.documentElement;
        html.lang = lang;
        html.dir = lang === 'ur' ? 'rtl' : 'ltr';
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
