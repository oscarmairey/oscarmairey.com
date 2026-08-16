import { deflateSync } from "node:zlib";

/* The editor, driven the way Oscar drives it: a real browser, a real click, a
   real keypress, a real file. It leaves what it makes behind: nothing deletes an
   entry, and the database is rebuilt from the migrations before every run. */

/* Where this is allowed to run, and it is not negotiable.
 *
 *  The suite writes, publishes, unpublishes and throws versions away through
 *  the real editor. Pointed at the site Oscar uses, a mistargeted click is a
 *  piece of his writing gone. So it only ever talks to a server on the loopback that
 *  scripts/test.mjs started for it, against a database of its own — run it with
 *  `npm test`, never by hand against a host. */
const BASE = process.env.TEST_BASE ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

const LIVE_PORTS = new Set(["3100", "3101"]); // production, and the dev server Oscar uses
const port = BASE.match(/^http:\/\/127\.0\.0\.1:(\d+)$/)?.[1];

if (!port || LIVE_PORTS.has(port) || /oscarmairey\.com/i.test(BASE)) {
  console.error(
    "refusing to run.\n" +
      `  TEST_BASE is ${JSON.stringify(BASE)}.\n` +
      "  It must be a loopback address this run started, and not 3100 or 3101,\n" +
      "  which are the site and the dev server Oscar is using.\n" +
      "  Use: npm test",
  );
  process.exit(2);
}
if (!PASSWORD) {
  console.error("refusing to run: no TEST_PASSWORD. Use: npm test");
  process.exit(2);
}

/* Imported after the refusal, so a wrong target is turned away whether or not
   the browser is even installed. */
const { chromium } = await import("playwright");

/* One browser, one context, one page, one flow at a time — the machine this
   runs on is somebody's desk. */
const LEAN = [
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--renderer-process-limit=1",
  "--js-flags=--max-old-space-size=512",
];

/* A big PNG, built here rather than carried around: 3000x2000 of pattern, which
   is what a photograph off a camera looks like to an uploader. */
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function bigPng(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width; x++) {
      raw[p++] = (x * 7 + y * 3) & 255;
      raw[p++] = (x * 13 + y) & 255;
      raw[p++] = (y * 11) & 255;
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BIG = bigPng(3000, 2000);

/* A one-pixel PNG, uploaded as if it came off a camera. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let failures = 0;
const ok = (name, pass, detail = "") => {
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!pass) failures += 1;
};

const browser = await chromium.launch({ args: LEAN });
/* Copy and paste are the point of one of the flows below, and a real Ctrl+C
   goes through the browser's own clipboard. */
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();

/* The test server compiles each route the first time it is asked for one, so
   the first visit to a page is slower than every visit after it. */
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(30000);

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
/* Kept, because what a destructive press says before it acts is part of what it
   does: with versions, "Delete" has to name how much it takes. */
let asked = "";
page.on("dialog", (d) => {
  asked = d.message();
  d.accept(d.type() === "prompt" ? "https://example.com" : undefined);
});

const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const status = () => text(".adm-status");
/* Inside the first word of the first line, and not on the space after it: a
   double click on a space selects a space, which is not a selection. */
const BODY = '[data-region="body"]';
const FIRST = `${BODY} > p:first-child`;

const srcs = () => page.$$eval(".prose figure img", (els) => els.map((e) => e.getAttribute("src")));
const caption = (s) =>
  page.evaluate(
    (one) => document.querySelector(`.prose figure:has(img[src="${one}"]) figcaption`)?.textContent,
    s,
  );
const settled = () =>
  page.waitForFunction(() => document.querySelector(".adm-status")?.textContent !== "Loading the editor…");

async function signIn() {
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  if (page.url().endsWith("/admin/login")) {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/admin`, { timeout: 20000 });
  }
}

/** Types at the end of a region, or over the whole of it when asked: a rewrite
 *  starts by taking out what was there. */
async function typeInto(selector, string, over = false) {
  await page.click(selector);
  await page.evaluate(
    ([s, all]) => {
      const el = document.querySelector(s);
      const range = document.createRange();
      range.selectNodeContents(el);
      if (!all) range.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    },
    [selector, over],
  );
  await page.keyboard.type(string, { delay: 25 });
}

/** The menu opens on a selection now, so it may already be there. */
async function menuOn(selector, item) {
  if ((await page.locator(".adm-menu").count()) === 0) {
    await page.click(selector, { button: "right" });
    await page.waitForSelector(".adm-menu");
  }
  await page.locator(".adm-menu button", { hasText: item }).first().click();
  await page.waitForTimeout(250);
}

const saved = () =>
  page.waitForFunction(
    () => /^Saved at/.test(document.querySelector(".adm-status")?.textContent ?? ""),
    null,
    { timeout: 20000 },
  );

/** A figure is not editable, so a right click on it is not by itself a question
 *  about it: the caret goes into its caption first, which is the editable part
 *  of it and what the menu reads to know which block it was asked about. Asked
 *  on the caption rather than on the picture, the menu also opens beside a line
 *  rather than in the middle of a tall photograph, where reaching it would mean
 *  a scroll, and a scroll is one of the things that closes it. */
async function removeFirstImage() {
  const cap = ".prose figure figcaption";
  await page.click(cap);
  await page.click(cap, { button: "right" });
  await page.waitForSelector('.adm-menu button:text-is("Remove image")');
  await page.click('.adm-menu button:text-is("Remove image")', { force: true });
  await page.waitForTimeout(250);
}

/* The right click has to land inside whatever is selected: a browser clears a
   selection when the press falls outside it, which is not a bug to chase. */
async function menu(on, item, position) {
  await page.click(on, { button: "right", ...(position ? { position } : {}) });
  await page.waitForSelector(".adm-menu");
  await page.locator(".adm-menu button", { hasText: item }).first().click();
  await page.waitForTimeout(200);
}

async function run(section, one) {
  console.log(`\n${section}`);
  const title = `Playwright ${one} ${Date.now()}`;
  const first = BODY;

  await page.goto(`${BASE}/admin/${section}/new`, { waitUntil: "networkidle" });
  await settled();

  /* ---- typing, and keeping it ------------------------------------------- */

  await typeInto('[data-region="title"]', title);
  ok("title takes typing", (await text('[data-region="title"]')) === title);
  await typeInto('[data-region="sub"]', "The line under the title.");
  ok("subtitle takes typing", (await text('[data-region="sub"]')) === "The line under the title.");
  await typeInto(FIRST, "The first paragraph, typed one character at a time.");
  ok("body takes typing", (await text(FIRST)) === "The first paragraph, typed one character at a time.");

  await page.waitForTimeout(2500);
  ok("title survives 2.5s", (await text('[data-region="title"]')) === title, await status());
  ok("body survives 2.5s", (await text(FIRST)) === "The first paragraph, typed one character at a time.");

  /* ---- blocks, and a selection that crosses them -------------------------- */

  await page.keyboard.press("Enter");
  await page.keyboard.type("A second paragraph.", { delay: 20 });
  await page.waitForTimeout(200);
  ok("Enter starts a paragraph", (await page.locator(`${BODY} > p`).count()) === 2);

  /* Shift+Enter stays inside the paragraph it is in. */
  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await page.keyboard.type("After a break.", { delay: 20 });
  await page.waitForTimeout(200);
  ok("Shift+Enter breaks the line", (await page.locator(`${BODY} > p br`).count()) === 1);
  ok("and stays in the paragraph", (await page.locator(`${BODY} > p`).count()) === 2);

  /* The whole point of one editing host. */
  const across = await page.evaluate((b) => {
    const host = document.querySelector(b);
    const first = host.querySelector("p:first-child").firstChild;
    const last = host.querySelector("p:last-child");
    const range = document.createRange();
    range.setStart(first, 4);
    range.setEnd(last, last.childNodes.length);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  }, BODY);
  ok("a selection crosses paragraphs", across.includes("first paragraph") && across.includes("After a break"), JSON.stringify(across.slice(0, 40)));

  await page.waitForTimeout(700);
  const held = await page.evaluate(() => getSelection().toString());
  ok("selection survives", held === across, JSON.stringify(held.slice(0, 30)));
  ok("a selection opens the menu", (await page.locator(".adm-menu").count()) === 1);

  /* Backspace at the start of a paragraph joins it to the one before. */
  await page.keyboard.press("Escape");
  await page.evaluate((b) => {
    /* The very start of the last paragraph: Home would only reach the start of
       the line, and that paragraph has two. */
    const last = document.querySelector(`${b} > p:last-child`);
    const range = document.createRange();
    range.setStart(last.firstChild, 0);
    range.collapse(true);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, BODY);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(250);
  const joined = await text(`${BODY} > p:first-child`);
  ok(
    "Backspace joins",
    (joined ?? "").includes("a time.A second paragraph."),
    JSON.stringify((joined ?? "").slice(-40)),
  );

  await menuOn(FIRST, "Heading");
  ok("Heading turns the block", (await page.locator(`${BODY} > h2`).count()) === 1);
  await menuOn(`${BODY} > h2`, "Paragraph");
  ok("Paragraph turns it back", (await page.locator(`${BODY} > h2`).count()) === 0);

  await page.dblclick(FIRST, { position: { x: 15, y: 8 } });
  await page.waitForTimeout(350);
  await menuOn(FIRST, "Bold");
  const marked = await page.evaluate((f) => document.querySelector(`${f} strong, ${f} b`)?.textContent, BODY);
  ok("Bold wraps the selection", (marked ?? "").trim().length > 0, JSON.stringify(marked));

  /* ---- an image ---------------------------------------------------------- */

  await page.click(FIRST);
  await page.click(FIRST, { button: "right" });
  await page.waitForSelector(".adm-menu");
  ok("the menu offers an image", (await page.locator('.adm-menu button:text-is("Image")').count()) === 1);
  await page.click('.adm-menu button:text-is("Image")');
  await page.setInputFiles(".adm-picker", { name: "A Photo.png", mimeType: "image/png", buffer: PNG });
  await page.waitForSelector(".prose figure img", { timeout: 15000 });

  const src = await page.getAttribute(".prose figure img", "src");
  /* One pixel is already smaller than anything webp could make of it, so the
     original stands: the downscale never hands back a bigger file. */
  ok("the image is in the page", /^\/media\/[a-z0-9-]+\.(png|webp)$/.test(src ?? ""), src);
  ok("the name carries the size", /-1x1\.(png|webp)$/.test(src ?? ""), src);
  ok("the name carries the file's own", /^\/media\/a-photo-/.test(src ?? ""), src);

  await page.keyboard.type("The caption.", { delay: 20 });
  await page.waitForTimeout(150);
  ok("the caption takes typing", (await caption(src)) === "The caption.");

  const media = await page.request.get(BASE + src);
  ok("/media serves it", media.status() === 200, String(media.status()));
  ok("with the right type", media.headers()["content-type"] === "image/png", media.headers()["content-type"]);
  ok("and asks to be kept", (media.headers()["cache-control"] ?? "").includes("immutable"));

  /* ---- an oversized one, shrunk on the way in ----------------------------- */

  let big = null;
  if (section === "notes") {
    await page.click(FIRST);
    await page.click(FIRST, { button: "right" });
    await page.waitForSelector('.adm-menu button:text-is("Image")');
    await page.click('.adm-menu button:text-is("Image")');
    await page.setInputFiles(".adm-picker", {
      name: "Enormous Photograph.png",
      mimeType: "image/png",
      buffer: BIG,
    });
    try {
      await page.waitForFunction(() => document.querySelectorAll(".prose figure img").length === 2, null, { timeout: 25000 });
    } catch (error) {
      console.log("  [no second figure]", await status(), await page.evaluate((b) => document.querySelector(b).innerHTML.slice(0, 200), BODY));
      throw error;
    }

    const shown = await srcs();
    big = shown.find((one) => one !== src);
    ok("the big one is re-encoded", (big ?? "").endsWith(".webp"), big);
    ok("and drawn down to the long edge", /-1600x1067\.webp$/.test(big ?? ""), big);

    const drawn = await page.evaluate((s) => {
      const img = document.querySelector(`.prose figure img[src="${s}"]`);
      return { w: img?.getAttribute("width"), h: img?.getAttribute("height") };
    }, big);
    ok("the page reserves the resized box", drawn.w === "1600" && drawn.h === "1067", JSON.stringify(drawn));

    const stored = await page.request.get(BASE + big);
    const bytes = Number(stored.headers()["content-length"]);
    ok("served as webp", stored.headers()["content-type"] === "image/webp");
    ok(
      "and materially smaller than the source",
      bytes > 0 && bytes < BIG.length / 2,
      `${Math.round(bytes / 1024)}kB from ${Math.round(BIG.length / 1024)}kB`,
    );
  }

  /* ---- what is under the title, and what is not -------------------------- */

  ok("no metadata row", (await page.locator(".adm-meta").count()) === 0);
  ok("no View button", (await page.locator('.adm-actions a:has-text("View")').count()) === 0);

  if (section === "notes") {
    await page.click(".stamp button.adm-when");
    await page.fill('.stamp input[type="date"]', "2026-01-15");
    await page.click('[data-region="title"]');
    await page.waitForTimeout(200);
    ok("the date is picked in the page", ((await text(".stamp")) ?? "").startsWith("15 January 2026"), await text(".stamp"));
    ok("the reading time is beside it", ((await text(".stamp")) ?? "").includes(" min"), await text(".stamp"));
  }
  if (section === "books") {
    await typeInto('[data-region="byline"]', "An Author");
    ok("the author sits under the title", (await text(".stamp")) === "An Author");
  }
  if (section === "companies") {
    await typeInto('[data-region="period"]', "Now");
    await typeInto('[data-region="byline"]', "The role");
    ok("period and role are typed in the page", (await text(".stamp")) === "Now · The role");
  }

  /* ---- save, reload, read it back ---------------------------------------- */

  ok("there is no Save button", (await page.locator('.adm-actions button:has-text("Save")').count()) === 0);
  await saved();
  const url = page.url();

  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("the title came back", (await text('[data-region="title"]')) === title);
  const back = await srcs();
  ok("the image came back", back.includes(src), back.join(" "));
  if (big) ok("the big one came back", back.includes(big), back.join(" "));
  ok("the caption came back", (await caption(src)) === "The caption.");
  if (section === "notes") ok("the date came back", ((await text(".stamp")) ?? "").startsWith("15 January 2026"));
  if (section === "books") ok("the author came back", (await text(".stamp")) === "An Author");
  if (section === "companies") ok("the period came back", (await text(".stamp")) === "Now · The role");

  /* ---- a draft is nobody's business but Oscar's ---------------------------- */

  const listed = () => page.locator(".rows a", { hasText: title }).count();

  await page.goto(`${BASE}/admin/${section}`, { waitUntil: "networkidle" });
  const state = await page.evaluate(
    (t) =>
      [...document.querySelectorAll(".rows li")].find((li) => li.textContent.includes(t))
        ?.querySelector(".when")?.textContent,
    title,
  );
  ok("the editor calls it a draft", state === "Draft", state);

  await page.goto(`${BASE}/${section}`, { waitUntil: "networkidle" });
  ok("a draft is invisible", (await listed()) === 0);

  const publish = async (word) => {
    await page.goto(url, { waitUntil: "networkidle" });
    await settled();
    await page.click(`.adm-actions button:text-is("${word}")`);
    try {
      await page.waitForSelector(
        `.adm-actions button:text-is("${word === "Publish" ? "Unpublish" : "Publish"}")`,
        { timeout: 15000 },
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        buttons: [...document.querySelectorAll(".adm-actions button")].map(
          (b) => `${b.textContent}${b.disabled ? " (disabled)" : ""}`,
        ),
        status: document.querySelector(".adm-status")?.textContent,
        url: location.pathname,
      }));
      console.log(`  [${word} did not take]`, JSON.stringify(state));
      throw error;
    }
    await page.goto(`${BASE}/${section}`, { waitUntil: "networkidle" });
  };

  await publish("Publish");
  ok("publishing puts it on the site", (await listed()) === 1);

  await publish("Unpublish");
  ok("unpublishing takes it off again", (await listed()) === 0);

  await publish("Publish");

  /* ---- and on the site itself --------------------------------------------- */

  const link = page.locator(".rows a", { hasText: title });
  ok("it is on the public list", (await link.count()) === 1);
  if (section === "books") {
    const line = await page.evaluate(
      (t) =>
        [...document.querySelectorAll(".rows li")].find((li) => li.textContent.includes(t))
          ?.textContent,
      title,
    );
    ok("with its author beside it", (line ?? "").includes("An Author"), line);
  }
  await link.first().click();
  /* A Link is a client-side transition: the load event already happened. */
  await page.waitForFunction((t) => document.querySelector("article h1")?.textContent === t, title, {
    timeout: 15000,
  });
  ok(
    "the image is on the public page",
    (await page.locator("article figure img").count()) === (big ? 2 : 1),
  );
  if (big) {
    const public_ = await page.$$eval("article figure img", (els) =>
      els.map((e) => e.getAttribute("src")),
    );
    ok("the big one is on the public page", public_.includes(big), public_.join(" "));
  }
  ok("the caption is with it", (await caption(src)) === "The caption.");
  if (section === "books") {
    ok("the author is under the title", (await text("article .stamp")) === "An Author");
  }

  /* ---- nothing here deletes it, and the file goes when the writing does ---- */

  await page.goto(url, { waitUntil: "networkidle" });
  await settled();
  ok(
    "there is no press that deletes the entry",
    (await page.locator('.adm-actions button:has-text("Delete")').count()) === 0,
  );

  /* An entry that stops mentioning a file takes the file with it, and a save is
     the only moment that can happen now. */
  for (let left = await page.locator(".prose figure").count(); left > 0; left -= 1) {
    await removeFirstImage();
  }
  ok("the images come out of the body", (await page.locator(".prose figure").count()) === 0);
  await saved();
  await page.waitForTimeout(400);
  ok("and the file goes with the mention of it", (await page.request.get(BASE + src)).status() === 404);
  if (big) ok("and so does the big one", (await page.request.get(BASE + big)).status() === 404);

  await page.goto(`${BASE}/admin/${section}`, { waitUntil: "networkidle" });
  ok("the Return link is there", (await page.locator('.adm-buttons a:has-text("Return")').count()) === 1);
}

/** B1: publishing dates an entry that had no date. The editor has to take that
 *  date back, or the next save sends the empty one it still holds and un-dates
 *  what is already on the site. */
async function dateSurvivesPublishing() {
  console.log("\ndates");
  const title = `Playwright dating ${Date.now()}`;

  await page.goto(`${BASE}/admin/notes/new`, { waitUntil: "networkidle" });
  await settled();
  await typeInto('[data-region="title"]', title);
  await typeInto(FIRST, "Never given a date by hand.");
  await page.waitForFunction(() => /^Saved at/.test(document.querySelector(".adm-status")?.textContent ?? ""), null, { timeout: 15000 });

  ok("undated before publishing", (await text(".stamp"))?.startsWith("Undated"), await text(".stamp"));

  await page.click('.adm-actions button:text-is("Publish")');
  await page.waitForSelector('.adm-actions button:text-is("Unpublish")', { timeout: 15000 });
  const stamped = await text(".stamp");
  ok("publishing stamps a date", !stamped.startsWith("Undated"), stamped);

  /* The save that used to wipe it, which now happens by itself. */
  await typeInto(FIRST, " Edited after publishing.");
  await saved();
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("the date survives the next save", (await text(".stamp")) === stamped, `${await text(".stamp")} vs ${stamped}`);
}

/** The keys that decide what a block is, and the menu that decides the rest. */
async function blocksBehave() {
  console.log("\nblocks");
  const title = `Playwright blocks ${Date.now()}`;
  const html = () => page.evaluate((b) => document.querySelector(b).innerHTML, BODY);

  await page.goto(`${BASE}/admin/notes/new`, { waitUntil: "networkidle" });
  await settled();
  await typeInto('[data-region="title"]', title);
  const url = () => page.url();

  /* A paragraph: Enter ends it, Shift+Enter only breaks the line. */
  await page.click(FIRST);
  await page.keyboard.type("First paragraph.", { delay: 15 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second paragraph.", { delay: 15 });
  await page.waitForTimeout(200);
  ok("Enter ends a paragraph", (await page.locator(`${BODY} > p`).count()) === 2, await html());

  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await page.keyboard.type("Same paragraph.", { delay: 15 });
  await page.waitForTimeout(200);
  ok("Shift+Enter stays in it", (await page.locator(`${BODY} > p`).count()) === 2 && (await page.locator(`${BODY} > p br`).count()) === 1, await html());

  /* A heading ends on Enter, and starts a paragraph rather than a heading. */
  await page.click(`${BODY} > p:first-child`);
  await menuOn(`${BODY} > p:first-child`, "Heading");
  ok("the menu makes a heading", (await page.locator(`${BODY} > h2`).count()) === 1);

  await page.click(`${BODY} > h2`);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Under the heading.", { delay: 15 });
  await page.waitForTimeout(200);
  ok("Enter at the end of a heading starts a paragraph",
     (await page.locator(`${BODY} > h2`).count()) === 1 && (await text(`${BODY} > h2`)) === "First paragraph.",
     await html());

  await page.click(`${BODY} > h2`);
  await page.keyboard.press("End");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("Enter inside a heading splits it", ((await text(`${BODY} > h2`)) ?? "").trim() === "First", await html());
  ok("and the rest is a paragraph", ((await text(`${BODY} > p:nth-of-type(1)`)) ?? "").includes("paragraph."), await html());

  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(150);
  ok("Shift+Enter in a heading does nothing", (await page.locator(`${BODY} > h2 br`).count()) === 0);

  /* Bullets. */
  await page.click(`${BODY} > p:last-child`);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("* one", { delay: 15 });
  await page.waitForTimeout(250);
  ok("an asterisk starts a list", (await page.locator(`${BODY} > ul > li`).count()) === 1, await html());

  await page.keyboard.press("Enter");
  await page.keyboard.type("two", { delay: 15 });
  await page.waitForTimeout(200);
  ok("Enter makes the next bullet", (await page.locator(`${BODY} > ul > li`).count()) === 2);

  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  ok("Enter on an empty bullet leaves the list", (await page.locator(`${BODY} > ul > li`).count()) === 2, await html());
  await page.keyboard.type("After the list.", { delay: 15 });
  await page.waitForTimeout(200);
  ok("and what follows is a paragraph", ((await text(`${BODY} > p:last-child`)) ?? "").includes("After the list."));

  /* The menu: it collapses the selection it acted on, and closes. */
  await page.dblclick(`${BODY} > p:last-child`, { position: { x: 15, y: 8 } });
  await page.waitForTimeout(400);
  ok("a selection opens the menu", (await page.locator(".adm-menu").count()) === 1);
  await page.click('.adm-menu button:text-is("Bold")');
  await page.waitForTimeout(250);
  ok("the menu closes after acting", (await page.locator(".adm-menu").count()) === 0);
  ok("and it made it bold", (await page.locator(`${BODY} strong, ${BODY} b`).count()) === 1);
  const after = await page.evaluate(() => {
    const selection = getSelection();
    const em = document.querySelector('[data-region="body"] strong, [data-region="body"] b');
    return {
      collapsed: selection.isCollapsed,
      atEnd: em ? em.contains(selection.anchorNode) || em.nextSibling === selection.anchorNode || selection.anchorNode?.parentElement === em.parentElement : false,
      text: em?.textContent,
    };
  });
  ok("and leaves the caret rather than the selection", after.collapsed, JSON.stringify(after));
  ok("on the text it changed", after.atEnd && (after.text ?? "").length > 0, JSON.stringify(after));

  /* And it dies with the selection it was asked about — dragged out with a
     mouse, the way Oscar makes one, and taken away four different ways. */
  const drag = async () => {
    /* Each gesture eats the text it selected, so put some back first. */
    await page.click(`${BODY} > p:nth-of-type(2)`);
    await page.keyboard.press("Home");
    await page.keyboard.type("wwwwwwwwwwwwwwww", { delay: 5 });
    await page.waitForTimeout(150);
    const box = await page.locator(`${BODY} > p:nth-of-type(2)`).boundingBox();
    await page.mouse.move(box.x + 8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    return page.locator(".adm-menu").count();
  };

  for (const key of ["Delete", "Backspace", "z", "Escape"]) {
    ok(`a drag opens the menu (before ${key})`, (await drag()) === 1);
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    ok(`${key} closes it`, (await page.locator(".adm-menu").count()) === 0);
  }

  /* The keyboard reaches the same three marks, and the link. */
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await page.click(`${BODY} > p:last-child`);
  await page.keyboard.type(" italic underlined", { delay: 15 });
  await page.waitForTimeout(150);

  for (const [word, key, tag] of [["italic", "i", "em, i"], ["underlined", "u", "u"]]) {
    await page.evaluate((w) => {
      const last = document.querySelector('[data-region="body"] > p:last-child');
      const node = [...last.childNodes].find((n) => n.nodeValue?.includes(w));
      const at = node.nodeValue.indexOf(w);
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + w.length);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }, word);
    await page.keyboard.press(`${mod}+${key}`);
    await page.waitForTimeout(200);
    ok(`Cmd+${key.toUpperCase()} marks the selection`, (await page.locator(`${BODY} :is(${tag})`).count()) >= 1);
  }

  /* Through the database and out the other side. */
  await saved();
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("the list came back", (await page.locator(`${BODY} > ul > li`).count()) === 2, await html());
  ok("the heading came back", (await page.locator(`${BODY} > h2`).count()) === 1);
  ok("the break came back", (await page.locator(`${BODY} > p br`).count()) === 1, await html());
  ok("bold came back", (await page.locator(`${BODY} strong`).count()) === 1, await html());
  ok("italic came back", (await page.locator(`${BODY} em`).count()) === 1);
  ok("the underline came back", (await page.locator(`${BODY} u`).count()) === 1);

  await page.click('.adm-actions button:text-is("Publish")');
  await page.waitForSelector('.adm-actions button:text-is("Unpublish")', { timeout: 15000 });
  await page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
  await page.locator(".rows a", { hasText: title }).first().click();
  await page.waitForFunction((t) => document.querySelector("article h1")?.textContent === t, title, { timeout: 15000 });
  ok("the list is on the public page", (await page.locator("article .prose ul li").count()) === 2);
  ok("the heading is with it", (await page.locator("article .prose h2").count()) === 1);
  ok("and the line break", (await page.locator("article .prose p br").count()) === 1);
  ok("bold is on the page", (await page.locator("article .prose strong").count()) === 1);
  ok("italic is on the page", (await page.locator("article .prose em").count()) === 1);
  ok("the underline is on the page", (await page.locator("article .prose u").count()) === 1);
}

/** The order is Oscar's, and it is dragged. */
async function ordersByHand() {
  console.log("\nordering");
  const titles = () => page.locator(".adm-rowbody a.t").allTextContents();

  await page.goto(`${BASE}/admin/books`, { waitUntil: "networkidle" });
  const before = await titles();
  ok("the list has grips", (await page.locator(".adm-grip").count()) === before.length, before.join(" | "));

  /* The third row, taken by its grip and carried above the first. */
  const grip = await page.locator(".adm-grip").nth(2).boundingBox();
  const first = await page.locator(".rows > li").first().boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + 40, first.y + first.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const after = await titles();
  ok("the row moved to the top", after[0] === before[2], after.join(" | "));
  ok("and the rest kept its order", after[1] === before[0] && after[2] === before[1], after.join(" | "));

  await page.waitForFunction(
    () => /^Saved at/.test(document.querySelector(".adm-status")?.textContent ?? ""),
    null,
    { timeout: 15000 },
  );

  await page.reload({ waitUntil: "networkidle" });
  ok("the order survives a reload", (await titles()).join(" | ") === after.join(" | "), (await titles()).join(" | "));

  await page.goto(`${BASE}/books`, { waitUntil: "networkidle" });
  const shown = await page.locator(".rows a.t").allTextContents();
  ok("the site reads it in that order", shown.join(" | ") === after.join(" | "), shown.join(" | "));

  /* And the keyboard reaches it too. */
  await page.goto(`${BASE}/admin/books`, { waitUntil: "networkidle" });
  await page.locator(".adm-grip").first().focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  const nudged = await titles();
  ok("an arrow moves a row", nudged[1] === after[0], nudged.join(" | "));
  await page.waitForFunction(
    () => /^Saved at/.test(document.querySelector(".adm-status")?.textContent ?? ""),
    null,
    { timeout: 15000 },
  );
  await page.reload({ waitUntil: "networkidle" });
  ok("and that survives too", (await titles()).join(" | ") === nudged.join(" | "));

  /* A new entry starts at the top, wherever the list has been dragged. */
  await page.goto(`${BASE}/admin/books/new`, { waitUntil: "networkidle" });
  await settled();
  const fresh = `Playwright newest ${Date.now()}`;
  await typeInto('[data-region="title"]', fresh);
  await saved();
  await page.goto(`${BASE}/admin/books`, { waitUntil: "networkidle" });
  ok("a new entry starts at the top", (await titles())[0] === fresh, (await titles()).slice(0, 2).join(" | "));
}

/** An entry written more than once, and the one version of it a reader gets.
 *
 *  The whole of the promise, in order: a version is its own page with its own
 *  state; another one starts from the one on screen and leaves it where it was;
 *  switching brings each back exactly as it was left; which one is on the site
 *  is a press, not the newest and not the last one typed into; and a version
 *  that nobody is being shown can be thrown away, while the entry itself never
 *  can be. */
async function versionsAreOscars() {
  console.log("\nversions");

  /* Two titles with no word in common, so "the page shows this one and not the
     other" is a question either can answer. */
  const stamp = Date.now();
  const title = `Playwright versions ${stamp}`;
  const second = `Playwright rewrite ${stamp}`;

  const V = (n) => `.adm-v[data-version="${n}"]`;
  const on = () => page.evaluate(() => document.querySelector(".adm-v.on")?.dataset.version ?? null);
  const liveMark = () =>
    page.evaluate(() => document.querySelector(".adm-v:has(.adm-vlive)")?.dataset.version ?? null);
  const canMakeLive = () => page.locator('.adm-actions button:text-is("Make live")').count();
  const BIN = '.adm-versions button[aria-label="Delete this version"]';
  const canDeleteVersion = () => page.locator(BIN).count();
  const count = () => page.locator(".adm-v[data-version]").count();
  const body = () => text(FIRST);

  const openVersion = async (n) => {
    await page.click(V(n));
    await page.waitForFunction((s) => document.querySelector(s)?.classList.contains("on"), V(n), {
      timeout: 20000,
    });
    await settled();
  };

  const madeLive = (n) =>
    page.waitForFunction(
      (want) => document.querySelector(".adm-v:has(.adm-vlive)")?.dataset.version === want,
      String(n),
      { timeout: 20000 },
    );

  /* ---- v1 ---------------------------------------------------------------- */

  await page.goto(`${BASE}/admin/notes/new`, { waitUntil: "networkidle" });
  await settled();
  ok("a new entry has no versions to name", (await page.locator(".adm-versions").count()) === 0);

  await typeInto('[data-region="title"]', title);
  await typeInto(FIRST, "The first writing of it.");
  await saved();

  const editor = page.url().replace(/\?.*$/, "");

  await page.waitForSelector(".adm-versions");
  ok("the first save makes a v1", (await count()) === 1);
  ok("and it is the live one", (await liveMark()) === "1");
  ok("so there is nothing to make live", (await canMakeLive()) === 0);
  ok("and nothing to delete, it being the live one", (await canDeleteVersion()) === 0);

  /* An image, put in v1 and never taken out of it. */
  await page.click(FIRST, { button: "right" });
  await page.waitForSelector('.adm-menu button:text-is("Image")');
  await page.click('.adm-menu button:text-is("Image")');
  await page.setInputFiles(".adm-picker", { name: "Kept.png", mimeType: "image/png", buffer: PNG });
  await page.waitForSelector(".prose figure img", { timeout: 15000 });
  const kept = await page.getAttribute(".prose figure img", "src");
  await saved();

  /* ---- one more, started from this one ------------------------------------ */

  await page.click(".adm-vplus");
  await page.waitForURL(/\?v=2$/, { timeout: 20000 });
  await settled();

  ok("the plus starts from what is on screen", (await text('[data-region="title"]')) === title);
  ok("body and all", ((await body()) ?? "").includes("first writing"));
  ok("image and all", (await srcs()).includes(kept), (await srcs()).join(" "));
  ok("it is the one being written", (await on()) === "2");
  ok("v1 is still the one on the site", (await liveMark()) === "1");
  ok("and now there is something to make live", (await canMakeLive()) === 1);

  /* Written over, which is what a rewrite is. */
  await removeFirstImage();
  await typeInto('[data-region="title"]', second, true);
  await typeInto(FIRST, "The second writing of it, which says something else.", true);
  await saved();
  ok("the reading time is this version's", ((await text(".stamp")) ?? "").includes(" min"));
  ok("the image it did not keep is out of it", (await srcs()).length === 0);
  await page.waitForTimeout(400);
  ok(
    "but the file stays, because v1 still refers to it",
    (await page.request.get(BASE + kept)).status() === 200,
  );

  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("v2 came back", (await text('[data-region="title"]')) === second);
  ok("with its own body", ((await body()) ?? "").includes("second writing"));
  ok("and the address still names it", /\?v=2$/.test(page.url()), page.url());

  /* ---- and v1 is exactly where it was left -------------------------------- */

  await openVersion(1);
  ok("v1 is untouched", (await text('[data-region="title"]')) === title);
  ok("body and all", ((await body()) ?? "").includes("first writing"));
  ok("image and all", (await srcs()).includes(kept), (await srcs()).join(" "));
  ok("and nothing to make live, being live", (await canMakeLive()) === 0);

  await openVersion(2);
  ok("and back to v2", (await text('[data-region="title"]')) === second);

  /* ---- what a reader gets is a press, not the newest ---------------------- */

  await page.click('.adm-actions button:text-is("Publish")');
  await page.waitForSelector('.adm-actions button:text-is("Unpublish")', { timeout: 20000 });

  const article = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    return page.evaluate(() => document.querySelector("article")?.textContent ?? "");
  };
  const get = async (path) => (await page.request.get(BASE + path)).text();

  const slug = editor.replace(`${BASE}/admin/notes/`, "");
  const page_ = `/notes/${slug}`;

  let shown = await article(page_);
  ok(
    "publishing puts the live version up, not the one being written",
    shown.includes(title) && !shown.includes(second),
    shown.slice(0, 80),
  );
  ok("and the live one is what the map says", (await get("/llms.txt")).includes(title));
  ok("and the markdown", (await get(`/md/notes/${slug}`)).startsWith(`# ${title}`));
  ok("and the feed", (await get("/feed.xml")).includes(title));

  /* ---- now the press ------------------------------------------------------ */

  await page.goto(`${editor}?v=2`, { waitUntil: "networkidle" });
  await settled();
  await page.click('.adm-actions button:text-is("Make live")');
  await madeLive(2);
  ok("the press moves the mark", (await liveMark()) === "2");
  ok("and takes itself away", (await canMakeLive()) === 0);
  ok("and the live one cannot be deleted", (await canDeleteVersion()) === 0);

  shown = await article(page_);
  ok("the site shows v2", shown.includes(second) && !shown.includes(title), shown.slice(0, 80));
  ok("the map shows v2", (await get("/llms.txt")).includes(second));
  ok("the whole of it shows v2", (await get("/llms-full.txt")).includes("second writing of it"));
  ok("the markdown shows v2", (await get(`/md/notes/${slug}`)).startsWith(`# ${second}`));
  ok("the feed shows v2", (await get("/feed.xml")).includes(second));
  ok("and the address never moved", (await get("/llms.txt")).includes(page_), page_);

  /* And v1 is still there to be opened, which is the point of all of it. */
  await page.goto(`${editor}?v=1`, { waitUntil: "networkidle" });
  await settled();
  ok("v1 is still there to open", (await text('[data-region="title"]')) === title);
  ok("with its body", ((await body()) ?? "").includes("first writing"));


  /* ---- what a version is called ------------------------------------------- */

  /* A name is only ever given to the version on screen, in the label it already
     carries: there is nowhere else on the line it could be typed. */
  const label = (n) => text(V(n));
  const named = async (n, to, becomes) => {
    await page.dblclick(V(n));
    await page.waitForSelector(".adm-vname");
    await page.fill(".adm-vname", to);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".adm-vname", { state: "detached", timeout: 15000 });
    /* Swallowed on purpose: an assertion that says what the line reads is worth
       more here than a stack trace. */
    await page
      .waitForFunction(
        ([sel, want]) => (document.querySelector(sel)?.textContent ?? "").startsWith(want),
        [V(n), becomes],
        { timeout: 15000 },
      )
      .catch(() => {});
  };

  await openVersion(2);
  ok("a version is its number until it is called something", (await label(2))?.startsWith("v2"), await label(2));

  await named(2, "short pitch", "short pitch");
  ok("the label becomes the name", (await label(2))?.startsWith("short pitch"), await label(2));
  ok("and the live mark is still with it", ((await label(2)) ?? "").includes("live"), await label(2));
  ok("while v1 is still v1", (await label(1))?.startsWith("v1"), await label(1));

  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("the name survives a reload", (await label(2))?.startsWith("short pitch"), await label(2));
  ok("and the address is still the number", /\?v=2$/.test(page.url()), page.url());

  await openVersion(1);
  await named(1, "long form", "long form");
  ok("both are named now",
     (await label(1))?.startsWith("long form") && (await label(2))?.startsWith("short pitch"),
     `${await label(1)} | ${await label(2)}`);

  /* And a name taken away is a version that goes back to being a number. */
  await named(1, "   ", "v1");
  ok("an empty name goes back to the number", (await label(1))?.startsWith("v1"), await label(1));
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("and that survives too", (await label(1))?.startsWith("v1"), await label(1));
  ok("while the other keeps its name", (await label(2))?.startsWith("short pitch"), await label(2));

  /* ---- the press that deletes one is a drawing, not a sentence ------------- */

  ok("the bin is on a version that is not live", (await canDeleteVersion()) === 1);
  const bin = await page.evaluate((sel) => {
    const svg = document.querySelector(`${sel} svg`);
    return svg && { fill: svg.getAttribute("fill"), stroke: svg.getAttribute("stroke") };
  }, BIN);
  ok("drawn as a hairline with nothing filled in",
     bin?.fill === "none" && bin?.stroke === "currentColor", JSON.stringify(bin));
  const target = await page.locator(BIN).boundingBox();
  ok("with room for a thumb around it", target.width >= 28 && target.height >= 28, JSON.stringify(target));
  ok("and it says what it is", (await page.getAttribute(BIN, "aria-label")) === "Delete this version");
  ok("with no word on the line", !((await text(".adm-versions")) ?? "").includes("Delete"));

  await openVersion(2);
  ok("never on the one the site is showing", (await canDeleteVersion()) === 0);

  /* Back to v1, which is where the rest of this picks up. */
  await openVersion(1);

  /* ---- one version thrown away, and only that ----------------------------- */

  await page.click(".adm-vplus");
  await page.waitForURL(/\?v=3$/, { timeout: 20000 });
  await settled();
  ok("a third, started from v1", (await text('[data-region="title"]')) === title);
  ok("image and all", (await srcs()).includes(kept));
  ok("and it can be deleted, not being live", (await canDeleteVersion()) === 1);

  await openVersion(2);
  ok("the live one still cannot", (await canDeleteVersion()) === 0);

  await openVersion(3);
  await page.click(BIN);
  await page.waitForURL(/\?v=2$/, { timeout: 20000 });
  await settled();
  ok("it says the rest stays", /other versions stay/.test(asked), asked);
  ok("v3 is gone", (await page.locator('.adm-v[data-version="3"]').count()) === 0);
  ok("v1 and v2 are not", (await count()) === 2);
  ok("and it lands on the live one", (await on()) === "2");

  ok("the entry is still there", (await page.request.get(`${editor}?v=1`)).status() === 200);
  shown = await article(page_);
  ok("and the site never noticed", shown.includes(second), shown.slice(0, 60));
  ok("the file v1 still uses is still there", (await page.request.get(BASE + kept)).status() === 200);

  await page.goto(`${editor}?v=3`, { waitUntil: "networkidle" });
  await settled();
  ok("a version that is gone falls back to the live one", (await on()) === "2");

  /* ---- back again, and back once more ------------------------------------- */

  await openVersion(1);
  await page.click('.adm-actions button:text-is("Make live")');
  await madeLive(1);
  shown = await article(page_);
  ok("the site flips back to v1", shown.includes(title) && !shown.includes(second), shown.slice(0, 80));

  await page.goto(`${editor}?v=2`, { waitUntil: "networkidle" });
  await settled();
  await page.click('.adm-actions button:text-is("Make live")');
  await madeLive(2);
  shown = await article(page_);
  ok("and forward again", shown.includes(second), shown.slice(0, 60));

  /* ---- the last one standing is the live one, and it stays ---------------- */

  await page.goto(`${editor}?v=1`, { waitUntil: "networkidle" });
  await settled();
  await page.click(BIN);
  await page.waitForURL(/\?v=2$/, { timeout: 20000 });
  await settled();
  ok("the one before last can go", (await count()) === 1);
  ok("what is left is the live one", (await liveMark()) === "2");
  ok("and it cannot be thrown away", (await canDeleteVersion()) === 0);
  await page.waitForTimeout(400);
  ok(
    "the file no version refers to any more went with it",
    (await page.request.get(BASE + kept)).status() === 404,
  );

  /* ---- and off the site, which is as far as anything goes ----------------- */

  ok(
    "there is no press that deletes the entry",
    (await page.locator('.adm-actions button:has-text("Delete")').count()) === 0,
  );
  ok("nor a word about whether it is live", (await status()) !== "On the site", await status());

  await page.click('.adm-actions button:text-is("Unpublish")');
  await page.waitForSelector('.adm-actions button:text-is("Publish")', { timeout: 20000 });
  await page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
  ok(
    "unpublishing still takes the whole entry off",
    (await page.locator(".rows a", { hasText: second }).count()) === 0,
  );
}

/** What arrives on a clipboard, and what leaves on one.
 *
 *  Two halves. Somebody else's markup is read into the site's own blocks and
 *  nothing of theirs survives the journey. The site's own writing carries its
 *  source with it, so a paste from one version into another is the blocks it
 *  was rather than a reading of the markup they were drawn as — which is the
 *  half Oscar actually does every day. */

/* A page's worth of markup, of the kind a clipboard really carries: a word
   processor's weight-on-a-span, its <b> wrapper that turns itself off again, a
   nested list, a hotlinked picture, classes and styles on everything, and a
   script for good measure. */
const RICH = `<b style="font-weight:normal" id="docs-internal-guid-1">
  <h1 class="headline" style="font-size:40px">A pasted heading</h1>
  <p class="lede" style="color:red">Some <b>bold</b>, some <i>italic</i>, some
     <u>underlined</u>, and a <a href="https://example.com/a" class="cta">link</a>.</p>
  <p>Before the break.<br>After the break.</p>
  <blockquote><p>The quoted sentence.</p><footer>&mdash; Somebody</footer></blockquote>
  <ul><li>First bullet</li><li>Second bullet<ul><li>Nested bullet</li></ul></li></ul>
  <p><span style="font-weight:700">Docs bold</span> and
     <span style="font-style:italic">Docs italic</span>.</p>
  <p><img src="https://example.com/hot.png" alt="hotlink">A picture that stays behind.</p>
  <script>window.pwned = 1</script>
  <table><tr><td>Cell one</td><td>Cell two</td></tr></table>
</b>`;

/** Puts the caret at the end of the body and hands it a clipboard. */
async function pasteHtml(html) {
  await page.evaluate(
    ([markup, region]) => {
      const host = document.querySelector(region);
      host.focus();
      const range = document.createRange();
      range.selectNodeContents(host.lastElementChild ?? host);
      range.collapse(false);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const carried = new DataTransfer();
      carried.setData("text/html", markup);
      carried.setData("text/plain", "the plain fallback");
      host.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: carried, bubbles: true, cancelable: true }),
      );
    },
    [html, BODY],
  );
  await page.waitForTimeout(400);
}

async function pasteKeepsItsShape() {
  console.log("\npaste");

  const stamp = Date.now();
  const one = `Playwright paste ${stamp}`;
  const two = `Playwright pasted again ${stamp}`;

  const has = (sel) => page.locator(`${BODY} ${sel}`).count();
  const innerBody = () => page.evaluate((b) => document.querySelector(b).innerHTML, BODY);

  /* ---- somebody else's markup -------------------------------------------- */

  await page.goto(`${BASE}/admin/notes/new`, { waitUntil: "networkidle" });
  await settled();
  await typeInto('[data-region="title"]', one);
  await typeInto(FIRST, "Written by hand, and then a paste under it.");
  await pasteHtml(RICH);

  ok("a heading arrives as the one heading there is", (await has("h2")) === 1, await innerBody());
  ok("with its text", (await text(`${BODY} h2`)) === "A pasted heading");
  ok("bold arrives", (await has("strong")) === 2, String(await has("strong")));
  ok("italic arrives", (await has("em")) === 2, String(await has("em")));
  ok("the underline arrives", (await has("u")) === 1);
  ok("a link arrives", (await has("a")) === 1);
  ok(
    "with its address",
    (await page.getAttribute(`${BODY} a`, "href")) === "https://example.com/a",
    await page.getAttribute(`${BODY} a`, "href"),
  );
  ok("a quote arrives", (await has("blockquote")) === 1);
  ok("with whoever said it", ((await text(`${BODY} blockquote`)) ?? "").includes("Somebody"));
  ok("a list arrives", (await has("ul")) === 1);
  ok("flattened to the one level the model has", (await has("ul li")) === 3, String(await has("ul li")));
  ok("a typed line break arrives", (await has("p br")) >= 1);
  ok("a table's cells arrive as lines", ((await innerBody()) ?? "").includes("Cell one"));

  const markup = await innerBody();
  ok("no class survives", !/class="(?!ref|sn|n|src)/.test(markup), markup.slice(0, 120));
  ok("no style survives", !markup.includes("style="), markup.slice(0, 120));
  ok("no script survives", !markup.includes("<script"), markup.slice(0, 120));
  ok("and no id from somebody else", !markup.includes("docs-internal-guid"));
  ok("an external picture is left behind", (await has("figure")) === 0);
  ok("but the words beside it are not", markup.includes("A picture that stays behind"));
  ok("nothing ran", (await page.evaluate(() => window.pwned)) === undefined);

  /* A sidenote of its own, so the copy below has one to carry. */
  await page.click(`${BODY} > p:first-child`);
  await menuOn(`${BODY} > p:first-child`, "Sidenote");
  await page.keyboard.type("A note in the margin.", { delay: 15 });
  await page.waitForTimeout(200);
  ok("a sidenote is on the page", (await has(".sn")) === 1);

  await saved();
  const first = page.url().replace(/\?.*$/, "");
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("it all came back through the database", (await has("h2")) === 1 && (await has("ul li")) === 3);
  ok("the link came back", (await has("a")) === 1);
  ok("the sidenote came back", (await has(".sn")) === 1);

  const stored = await innerBody();

  await page.click('.adm-actions button:text-is("Publish")');
  await page.waitForSelector('.adm-actions button:text-is("Unpublish")', { timeout: 20000 });
  const slug = first.replace(`${BASE}/admin/notes/`, "");
  await page.goto(`${BASE}/notes/${slug}`, { waitUntil: "networkidle" });
  ok("the heading is on the public page", (await page.locator("article .prose h2").count()) === 1);
  ok("the list is on the public page", (await page.locator("article .prose ul li").count()) === 3);
  ok("the link is on the public page", (await page.locator("article .prose a").count()) === 1);
  ok("and the sidenote", (await page.locator("article .prose .sn").count()) === 1);

  /* ---- and the site's own, which is the half that matters ---------------- */

  await page.goto(first, { waitUntil: "networkidle" });
  await settled();

  /* What the copy handler actually puts on a clipboard, read straight back. */
  const carried = await page.evaluate((b) => {
    const host = document.querySelector(b);
    host.focus();
    const range = document.createRange();
    range.selectNodeContents(host);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const data = new DataTransfer();
    host.dispatchEvent(new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }));
    return { plain: data.getData("text/plain"), html: data.getData("text/html") };
  }, BODY);

  ok("copying puts the source itself on the clipboard", carried.plain.includes("## A pasted heading"), carried.plain.slice(0, 60));
  ok("marks and all", carried.plain.includes("**bold**") && carried.plain.includes("*italic*"));
  ok("links and all", carried.plain.includes("[link](https://example.com/a)"));
  ok("quotes and all", carried.plain.includes("> The quoted sentence."));
  ok("bullets and all", carried.plain.includes("* First bullet"));
  ok("sidenotes and all", /\[\^\d\]: A note in the margin\./.test(carried.plain), carried.plain.slice(0, 80));
  ok("and the markup carries the source with it", carried.html.includes("data-om-blocks="), carried.html.slice(0, 80));

  /* Now the real thing: Ctrl+C here, Ctrl+V in another entry. */
  await page.keyboard.press("Control+c");
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/admin/notes/new`, { waitUntil: "networkidle" });
  await settled();
  await typeInto('[data-region="title"]', two);
  await page.click(FIRST);
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(600);

  ok("the heading came across", (await has("h2")) === 1, await innerBody());
  ok("with its text", (await text(`${BODY} h2`)) === "A pasted heading");
  ok("bold, italic and the underline came across",
     (await has("strong")) === 2 && (await has("em")) === 2 && (await has("u")) === 1);
  ok("the link came across", (await has("a")) === 1);
  ok("the quote came across", (await has("blockquote")) === 1);
  ok("the list came across", (await has("ul li")) === 3);
  ok("and the sidenote came across", (await has(".sn")) === 1);

  await saved();
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  ok("what was stored is what was copied, block for block", (await innerBody()) === stored, await innerBody());
}

/** What a machine reading the site on somebody's behalf is given. */
async function machinesCanRead() {
  console.log("\nmachines");

  const get = async (path) => {
    const answer = await page.request.get(BASE + path);
    return { status: answer.status(), type: answer.headers()["content-type"] ?? "", body: await answer.text() };
  };

  const robots = await get("/robots.txt");
  ok("robots.txt is served", robots.status === 200 && robots.type.startsWith("text/plain"), `${robots.status} ${robots.type}`);
  ok("it turns nobody away but the editor", robots.body.includes("Disallow: /admin") && !/Disallow:\s*\/\s*$/m.test(robots.body));
  ok("the assistants are named", ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"].every((n) => robots.body.includes(n)));
  ok("and the map is pointed at", robots.body.includes("/llms.txt") && robots.body.includes("Sitemap:"));

  const sitemap = await get("/sitemap.xml");
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((l) => l[1]);
  ok("the sitemap is served", sitemap.status === 200 && locs.length > 0, `${sitemap.status} ${locs.length} urls`);
  for (const route of ["/notes", "/books", "/companies"]) {
    const listed = locs.includes(`https://oscarmairey.com${route}`);
    const carries = locs.some((l) => l.startsWith(`https://oscarmairey.com${route}/`));
    ok(`${route} is in the map only when something is published on it`, listed === carries, `listed ${listed}, entries ${carries}`);
  }
  ok("and no drafts", !locs.some((l) => l.endsWith("/build-it-then-sell-it")), locs.join(" "));

  const map = await get("/llms.txt");
  ok("llms.txt is served", map.status === 200 && map.type.startsWith("text/plain"), `${map.status} ${map.type}`);
  ok("it opens with the name and the bio", map.body.startsWith("# Oscar Mairey") && map.body.includes("> "), map.body.slice(0, 60));
  ok("it lists all three", ["## Notes", "## Books", "## Companies"].every((h) => map.body.includes(h)));
  ok("with absolute addresses", /- \[[^\]]+\]\(https:\/\/oscarmairey\.com\/(notes|books|companies)\//.test(map.body));
  ok("and no drafts", !map.body.includes("Build It, Then Sell It"), "a draft leaked into llms.txt");

  const full = await get("/llms-full.txt");
  ok("llms-full.txt is served", full.status === 200 && full.type.startsWith("text/plain"));
  ok("it carries the bodies", full.body.includes("Every firm I have worked in kept its obligations"), full.body.length + " chars");
  ok("with headings as markdown", full.body.includes("## What the work actually is"));
  ok("and quotes as markdown", full.body.includes("> The depositary shall ensure"));
  ok("and footnotes at the foot", full.body.includes("[^1]: A few hundred is not a rhetorical figure"));
  ok("and no drafts", !full.body.includes("Build It, Then Sell It"));

  const one = await get("/md/notes/compliance-is-a-software-problem");
  ok("an entry is markdown on its own", one.status === 200 && one.type.startsWith("text/markdown"), `${one.status} ${one.type}`);
  ok("it opens with the title", one.body.startsWith("# Compliance Is a Software Problem"), one.body.slice(0, 40));
  ok("it says where it lives", one.body.includes("- URL: https://oscarmairey.com/notes/compliance-is-a-software-problem"));
  ok("and when it went up", one.body.includes("- Published: 2026-08-12"));

  const draft = await get("/md/notes/build-it-then-sell-it");
  ok("a draft has no markdown either", draft.status === 404, String(draft.status));
  const nonsense = await get("/md/nowhere/x");
  ok("and neither has a list that does not exist", nonsense.status === 404, String(nonsense.status));

  await page.goto(`${BASE}/notes/compliance-is-a-software-problem`, { waitUntil: "networkidle" });
  const linked = await page.getAttribute('link[rel="alternate"][type="text/markdown"]', "href");
  ok("the page points at its markdown", linked === "https://oscarmairey.com/md/notes/compliance-is-a-software-problem", String(linked));

  /* Next assigns `alternates` rather than merging it, so a page that names its
     own canonical takes the map and the feed down with it unless both are
     written from the one helper. Checked here, where a page has done exactly
     that. */
  const heads = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('link[rel="alternate"]')].map((l) => [l.type, l.getAttribute("href")]),
    ),
  );
  ok("and at the map for a machine", heads["text/plain"] === "https://oscarmairey.com/llms.txt", JSON.stringify(heads));
  ok("with the feed still there", heads["application/rss+xml"] === "https://oscarmairey.com/feed.xml", JSON.stringify(heads));

  const types = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)["@type"]),
  );
  ok("and describes itself as an Article", types.includes("Article"), types.join(", "));
  ok("with the Person still there", types.includes("Person"), types.join(", "));

  const shape = await page.evaluate(() => {
    const article = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent))
      .find((d) => d["@type"] === "Article");
    return { headline: article.headline, published: article.datePublished, author: article.author?.name, url: article.url };
  });
  ok("saying only what is true", shape.headline === "Compliance Is a Software Problem" && shape.published === "2026-08-12" && shape.author === "Oscar Mairey", JSON.stringify(shape));

  ok("one h1 on the page", (await page.locator("h1").count()) === 1);
  ok("the body is an article", (await page.locator("article").count()) === 1);
  ok("the date is a time", (await page.locator("article time[datetime]").count()) === 1);
}

await signIn();
for (const [section, one] of [["notes", "note"], ["books", "book"], ["companies", "company"]]) {
  if (process.env.ONLY && process.env.ONLY !== section) continue;
  await run(section, one);
}
if (!process.env.ONLY) await dateSurvivesPublishing();
if (!process.env.ONLY || process.env.ONLY === "blocks") await blocksBehave();
if (!process.env.ONLY || process.env.ONLY === "ordering") await ordersByHand();
if (!process.env.ONLY || process.env.ONLY === "versions") await versionsAreOscars();
if (!process.env.ONLY || process.env.ONLY === "paste") await pasteKeepsItsShape();
if (!process.env.ONLY || process.env.ONLY === "machines") await machinesCanRead();

console.log(`\npage errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(`  ${e.slice(0, 200)}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
