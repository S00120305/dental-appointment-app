import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // TODO: 患者一覧取得
  return NextResponse.json({ patients: [] })
}

export async function POST(request: NextRequest) {
  // TODO: 患者登録
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 })
}
