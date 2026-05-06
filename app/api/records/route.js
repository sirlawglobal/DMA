import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Record from '@/models/Record';

/**
 * GET /api/records
 * Returns all records sorted by createdAt descending.
 */
export async function GET() {
  try {
    await connectDB();
    const records = await Record.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error('[GET /api/records]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/records
 * Updates the status of a single record.
 * Body: { id, status }
 */
export async function PATCH(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const validStatuses = ['Released', 'In Transit', 'Delivered'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updated = await Record.findByIdAndUpdate(
      id,
      { status },
      { new: true, lean: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/records]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
