import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // TODO: 予約一覧取得
  return NextResponse.json({ appointments: [] })
}

export async function POST(request: NextRequest) {
  // TODO: 予約作成
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
