import "server-only"

const DEFAULT_BASE_URL = process.env.LIBGEN_BASE_URL ?? "https://libgen.la"
const REQUEST_TIMEOUT_MS = 15_000
const PAGE_SIZE = 25
const MD5_REGEX = /^[a-f0-9]{32}$/i

export type LibgenSearchOptions = {
  query: string
  count?: number
  offset?: number
  searchIn?: "def" | "title" | "author" | "series" | "publisher" | "year" | "identifier" | "md5" | "extension"
  sortBy?: "def" | "title" | "publisher" | "year" | "pages" | "language" | "filesize" | "extension"
  reverse?: boolean
}

export type BookSearchResult = {
  id: string
  title: string
  author: string
  publisher: string
  year: string
  language: string
  pages: string
  filesize: string
  extension: string
  md5: string
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function decodeEntities(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
}

function stripTags(html: string) {
  return decodeEntities(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchText(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "chainraizer-books/1.0"
      },
      cache: "no-store"
    })

    if (!response.ok)
      throw new Error(`LibGen request failed with ${response.status}`)

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function parseRow(rowHtml: string): BookSearchResult | null {
  const cells = Array.from(
    rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
    (match) => match[1]
  )

  if (cells.length < 8)
    return null

  const titleSection = cells[0].split(/<\/b><br\s*\/?>/i)[1] || cells[0]
  const titleMatch = titleSection.match(/href="[^"]*">([^<]+)/i)
  const idMatch = rowHtml.match(/ID:\s*([0-9]+)/i)
  const md5Match = rowHtml.match(/\/(?:ads|get)\.php\?md5=([a-f0-9]{32})/i)

  const result: BookSearchResult = {
    id: idMatch?.[1] ?? "",
    title: titleMatch ? stripTags(titleMatch[1]) : stripTags(cells[0]),
    author: stripTags(cells[1]),
    publisher: stripTags(cells[2]),
    year: stripTags(cells[3]),
    language: stripTags(cells[4]),
    pages: stripTags(cells[5]),
    filesize: stripTags(cells[6]),
    extension: stripTags(cells[7]).toLowerCase(),
    md5: md5Match?.[1]?.toLowerCase() ?? ""
  }

  return result.title ? result : null
}

function parseRows(html: string) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)

  if (!tbodyMatch)
    return []

  return Array.from(
    tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi),
    (match) => parseRow(match[1])
  ).filter((value): value is BookSearchResult => value !== null)
}

function buildSearchUrl(baseUrl: string, options: Required<Pick<LibgenSearchOptions, "query" | "count" | "offset">> & Omit<LibgenSearchOptions, "query" | "count" | "offset">, page: number) {
  const params = new URLSearchParams()
  let query = options.query

  if (options.searchIn && options.searchIn !== "def")
    query = `${options.searchIn}:${query}`

  params.set("req", query)
  params.set("curtab", "f")
  params.set("filesuns", "all")

  if (options.sortBy && options.sortBy !== "def") {
    params.set("order", options.sortBy)
    params.set("ordermode", options.reverse ? "desc" : "asc")
  }

  if (page > 1)
    params.set("page", String(page))

  return `${normalizeBaseUrl(baseUrl)}/index.php?${params.toString()}`
}

function clampCount(value: number | undefined) {
  if (!value || Number.isNaN(value))
    return 10

  return Math.min(Math.max(value, 1), 50)
}

function clampOffset(value: number | undefined) {
  if (!value || Number.isNaN(value))
    return 0

  return Math.max(value, 0)
}

export async function searchBooks(options: LibgenSearchOptions) {
  const query = options.query.trim()

  if (query.length < 4)
    throw new Error("Search query must be at least four characters")

  const count = clampCount(options.count)
  const offset = clampOffset(options.offset)
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const needed = count + (offset % PAGE_SIZE)

  let collected: BookSearchResult[] = []
  let currentPage = page

  while (collected.length < needed) {
    const html = await fetchText(
      buildSearchUrl(DEFAULT_BASE_URL, {
        ...options,
        query,
        count,
        offset
      }, currentPage)
    )

    const pageResults = parseRows(html)

    if (pageResults.length === 0)
      break

    collected = collected.concat(pageResults)

    if (pageResults.length < PAGE_SIZE)
      break

    currentPage += 1
  }

  if (collected.length === 0)
    return []

  const start = offset % PAGE_SIZE
  return collected.slice(start, start + count)
}

export async function resolveDownloadUrl(md5: string) {
  const normalizedMd5 = md5.trim().toLowerCase()

  if (!MD5_REGEX.test(normalizedMd5))
    throw new Error("A valid MD5 is required")

  const baseUrl = normalizeBaseUrl(DEFAULT_BASE_URL)
  const landingPage = await fetchText(`${baseUrl}/get.php?md5=${normalizedMd5}`)
  const directMatch = landingPage.match(/href="(get\.php\?md5=[a-f0-9]{32}&key=[^"]+)"/i)

  if (!directMatch)
    throw new Error("No direct download link found")

  return `${baseUrl}/${directMatch[1].replace(/^\//, "")}`
}
