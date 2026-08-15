import { deflateSync } from "node:zlib";

/* The editor, driven the way Oscar drives it: a real browser, a real click, a
   real keypress, a real file. Everything it makes, it deletes on the way out. */

/* Where this is allowed to run, and it is not negotiable.
 *
 *  The suite writes, publishes, unpublishes and deletes through the real
 *  editor. Pointed at the site Oscar uses, a mistargeted click is a piece of
 *  his writing gone. So it only ever talks to a server on the loopback that
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

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

/* The test server compiles each route the first time it is asked for one, so
   the first visit to a page is slower than every visit after it. */
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(30000);

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "https://example.com" : undefined));

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

async function typeInto(selector, string) {
  await page.click(selector);
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, selector);
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

  /* ---- out again, and the file with it ------------------------------------ */

  await page.goto(url, { waitUntil: "networkidle" });
  await settled();
  await page.click('.adm-actions button:has-text("Delete")');
  await page.waitForURL(`${BASE}/admin/${section}`, { timeout: 15000 });
  ok("deletes", (await page.locator(".rows a", { hasText: title }).count()) === 0);
  ok("the Return link is there", (await page.locator('.adm-buttons a:has-text("Return")').count()) === 1);

  await page.waitForTimeout(300);
  ok("the file went with it", (await page.request.get(BASE + src)).status() === 404);
  if (big) ok("and so did the big one", (await page.request.get(BASE + big)).status() === 404);
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

  const url = page.url();
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

  await page.goto(url, { waitUntil: "networkidle" });
  await settled();
  await page.click('.adm-actions button:has-text("Delete")');
  await page.waitForURL(`${BASE}/admin/notes`, { timeout: 15000 });
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
  const editor = url();
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

  await page.goto(editor, { waitUntil: "networkidle" });
  await settled();
  await page.click('.adm-actions button:has-text("Delete")');
  await page.waitForURL(`${BASE}/admin/notes`, { timeout: 15000 });
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

await signIn();
for (const [section, one] of [["notes", "note"], ["books", "book"], ["companies", "company"]]) {
  if (process.env.ONLY && process.env.ONLY !== section) continue;
  await run(section, one);
}
if (!process.env.ONLY) await dateSurvivesPublishing();
if (!process.env.ONLY || process.env.ONLY === "blocks") await blocksBehave();
if (!process.env.ONLY || process.env.ONLY === "ordering") await ordersByHand();

console.log(`\npage errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(`  ${e.slice(0, 200)}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
