import { NextRequest, NextResponse } from 'next/server';
import {
  getStoryModuleRecord,
  saveStoryModuleRecord,
  getAllStoryModuleRecords,
} from '@/lib/story-persistence';

// GET /api/story-extractor/record?module=<name>  → fetch single record
// GET /api/story-extractor/record                → fetch all module names
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get('module');

  try {
    if (moduleName) {
      const record = getStoryModuleRecord(moduleName);
      return NextResponse.json({ success: true, record });
    } else {
      const records = getAllStoryModuleRecords();
      return NextResponse.json({ success: true, moduleNames: Object.keys(records) });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/story-extractor/record  → save / update a record
export async function POST(request: NextRequest) {
  try {
    const { moduleName, data } = await request.json();
    if (!moduleName || !data) {
      return NextResponse.json({ success: false, error: 'Missing moduleName or data' }, { status: 400 });
    }
    const record = saveStoryModuleRecord(moduleName, data);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
