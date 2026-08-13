import { NextResponse } from "next/server"

import { resolveDownloadUrl } from "@/lib/books/libgen"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const md5 = searchParams.get("md5")?.trim() ?? ""
  const format = searchParams.get("format")

  if (!md5) {
    return NextResponse.json(
      { error: "md5 is required" },
      { status: 400 }
    )
  }

  try {
    const url = await resolveDownloadUrl(md5)

    if (format === "json")
      return NextResponse.json({ md5, url })

    return NextResponse.redirect(url, 302)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download resolution failed"

    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }
}
