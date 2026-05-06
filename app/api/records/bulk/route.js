import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Record from '@/models/Record';
import Batch from '@/models/Batch';

/**
 * Generate a batchId in the format BATCH-YYYY-MM-DD-NNN.
 * The counter resets daily and increments per upload.
 */
async function generateBatchId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Count how many batches already exist for today
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const todayCount = await Batch.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const counter = String(todayCount + 1).padStart(3, '0');
  return `BATCH-${dateStr}-${counter}`;
}

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { rows, personInCharge, status } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }
    if (!personInCharge) {
      return NextResponse.json({ error: 'personInCharge is required' }, { status: 400 });
    }

    // Filter out empty rows (rows where all values are falsy)
    const validRows = rows.filter((row) => {
      // Check for any of the expected column names
      const sn = row['S/N'] ?? row['s/n'] ?? row['SN'] ?? row['sn'] ?? row['Serial Number'] ?? row['serial_number'] ?? '';
      const waybill =
        row['WAYBILLS'] ??
        row['Waybills'] ??
        row['waybills'] ??
        row['WAYBILL'] ??
        row['Waybill'] ??
        row['waybill'] ??
        '';
      const address = row['ADDRESS'] ?? row['Address'] ?? row['address'] ?? '';

      return String(sn).trim() !== '' || String(waybill).trim() !== '' || String(address).trim() !== '';
    });

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 });
    }

    // Generate ONE batchId for the entire upload
    const batchId = await generateBatchId();

    // Save the Batch document first
    await Batch.create({
      batchId,
      personInCharge,
      status: status || 'Released',
      totalRecords: validRows.length,
    });

    // Map Excel rows to Record documents.
    // Fallback serial number: use row index (padded) when the column is blank.
    const records = validRows.map((row, idx) => {
      const rawSN = String(
        row['S/N'] ?? row['s/n'] ?? row['SN'] ?? row['sn'] ?? row['Serial Number'] ?? row['serial_number'] ?? ''
      ).trim();
      const serialNumber = rawSN !== '' ? rawSN : String(idx + 1).padStart(3, '0');

      const waybill = String(
        row['WAYBILLS'] ??
        row['Waybills'] ??
        row['waybills'] ??
        row['WAYBILL'] ??
        row['Waybill'] ??
        row['waybill'] ??
        ''
      ).trim();

      const address = String(
        row['ADDRESS'] ?? row['Address'] ?? row['address'] ?? ''
      ).trim();

      return {
        serialNumber,
        waybill,
        address,
        personInCharge,
        status: status || 'Released',
        batchId,
      };
    });

    const inserted = await Record.insertMany(records);

    return NextResponse.json(
      {
        message: 'Upload successful',
        batchId,
        totalInserted: inserted.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/records/bulk]', error);
    // Surface validation messages to the client so they're visible in the UI
    const message =
      error.name === 'ValidationError'
        ? Object.values(error.errors).map((e) => e.message).join('; ')
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    // Delete all records with this batchId
    const recordsResult = await Record.deleteMany({ batchId });
    // Delete the batch document itself
    const batchResult = await Batch.deleteOne({ batchId });

    return NextResponse.json({
      message: 'Batch deleted successfully',
      recordsDeleted: recordsResult.deletedCount,
      batchDeleted: batchResult.deletedCount > 0,
    }, { status: 200 });

  } catch (error) {
    console.error('[DELETE /api/records/bulk]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
