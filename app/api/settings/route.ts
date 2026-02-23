import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // TODO: 設定取得
  return NextResponse.json({ settings: {} })
}

export async function PUT(request: NextRequest) {
  // TODO: 設定更新
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
