/** Pull a JSON object out of Groq/OpenAI chat content (fences or extra prose). */
export function extractJsonObject(content: string): unknown {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const attempts = [stripped];
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) {
    attempts.push(stripped.slice(start, end + 1));
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt || '{}');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('response is not valid JSON');
}
