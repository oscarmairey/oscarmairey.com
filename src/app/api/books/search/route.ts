import { NextResponse } from "next/server"

import { searchBooks } from "@/lib/books/libgen"

export const runtime = "nodejs"

function toInt(value: string | null, fallback: number) {
  if (!value)
    return fallback

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const count = toInt(searchParams.get("count"), 10)
  const offset = toInt(searchParams.get("offset"), 0)
  const searchIn = searchParams.get("searchIn") ?? "def"
  const sortBy = searchParams.get("sortBy") ?? "def"
  const reverse = searchParams.get("reverse") === "true"

  if (query.length < 4) {
    return NextResponse.json(
      { error: "Query must be at least four characters" },
      { status: 400 }
    )
  }

  try {
    const results = await searchBooks({
      query,
      count,
      offset,
      searchIn: searchIn as Parameters<typeof searchBooks>[0]["searchIn"],
      sortBy: sortBy as Parameters<typeof searchBooks>[0]["sortBy"],
      reverse
    })

    return NextResponse.json({
      query,
      count,
      offset,
      results
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"

    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }
}
