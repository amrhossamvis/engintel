import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'engintel_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Fallback password used when PORTAL_PASSWORD env var is not set.
// Set PORTAL_PASSWORD in your hosting environment to override this.
const DEFAULT_PASSWORD = 'engintel2026';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const validPassword = process.env.PORTAL_PASSWORD || DEFAULT_PASSWORD;

    if (!password || password !== validPassword) {
      return NextResponse.json(
        { error: 'Invalid password. Please try again.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set(COOKIE_NAME, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}
