import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const html = await readFile(
  new URL("../landing.html", import.meta.url),
  "utf8",
);
const css = await readFile(new URL("../landing.css", import.meta.url), "utf8");
const js = await readFile(new URL("../landing.js", import.meta.url), "utf8");
const telegramUrl = "https://t.me/extaz_assistant_bot?start=src_landing";

assert.match(html, /<html lang="ru">/);
assert.equal(
  (html.match(/<h1\b/g) || []).length,
  1,
  "Landing must have exactly one h1",
);
assert.match(html, /rel="canonical" href="https:\/\/mindcoachbot\.ru\/"/);
assert.match(html, /property="og:image"/);
assert.match(html, /<meta\s+[\s\S]*?name="description"/);
assert.match(html, /id="main"/);
assert.match(html, /class="skip-link"/);
assert.match(html, /<script type="application\/ld\+json">/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /:focus-visible/);
assert.doesNotMatch(html, /target="_blank"/);
assert.doesNotMatch(html, /http:\/\//);
assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie/);

const ctaTags = [...html.matchAll(/<a\b[^>]*data-cta="([^"]+)"[^>]*>/g)];
assert.ok(ctaTags.length >= 6, "Expected repeated conversion CTAs");
for (const match of ctaTags) {
  const [tag, location] = match;
  assert.ok(
    tag.includes(`href="${telegramUrl}"`),
    `CTA ${location} must use the tracked Telegram deep link`,
  );
}

for (const file of [
  "../favicon.svg",
  "../site.webmanifest",
  "../robots.txt",
  "../sitemap.xml",
  "../og-image-v2.png",
]) {
  await access(new URL(file, import.meta.url));
}

console.log(`Landing smoke passed: ${ctaTags.length} tracked Telegram CTAs`);
