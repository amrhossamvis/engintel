import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin identity uses a SECRET EMOJI PASSPHRASE.
 *
 * Default: 🚀🧠⚡🔥  (set ADMIN_PASSPHRASE env var to override)
 *
 * This is intentionally different from the portal password:
 * - Portal password = access to the hub (all engineers)
 * - Admin passphrase = edit/delete powers (platform team only)
 *
 * The passphrase is stored in a short-lived cookie (4h) so admins
 * don't have to re-enter it on every action.
 */

const ADMIN_COOKIE = 'engintel_admin';
const COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours
const DEFAULT_PASSPHRASE = '🚀🧠⚡🔥';

export async function POST(req: NextRequest) {
  try {
    const { passphrase } = await req.json();
    const valid = process.env.ADMIN_PASSPHRASE || DEFAULT_PASSPHRASE;

    if (!passphrase || passphrase !== valid) {
      return NextResponse.json({ error: 'Invalid passphrase.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  // Sign out of admin mode
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE);
  const isAdmin = cookie?.value === 'true';
  return NextResponse.json({ isAdmin });
}
