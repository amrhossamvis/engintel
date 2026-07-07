import { NextResponse } from "next/server";

/**
 * Validate a GitHub token by calling the GitHub API as that token.
 * 200 → valid; returns the login so the UI can confirm the identity.
 */
export async function POST(req: Request) {
  let token = "";
  try {
    token = (await req.json())?.token ?? "";
  } catch {
    return NextResponse.json({ valid: false, error: "bad_request" }, { status: 400 });
  }
  if (!token || token.trim().length < 8) {
    return NextResponse.json({ valid: false });
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ valid: false, status: res.status });
    }

    const user = await res.json();
    return NextResponse.json({
      valid: true,
      login: user.login,
      name: user.name ?? user.login,
      avatarUrl: user.avatar_url,
    });
  } catch {
    return NextResponse.json({ valid: false, error: "network" }, { status: 502 });
  }
}
