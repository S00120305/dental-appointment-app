import { NextResponse } from 'next/server'

/**
 * 古い（domainなし＝ホスト名のみ）Cookieを削除するSet-Cookieヘッダーを追加。
 *
 * response.cookies.set() は同名Cookieを内部Mapで上書きするため、
 * domainなしとdomain付きの2つを同時に送信できない。
 * そのためdomainなしの削除はraw Set-Cookieヘッダーで直接追加する。
 *
 * 重要: response.cookies.set() を全て呼んだ後に実行すること。
 * （cookies.set()は内部的にheaders.set()で全Set-Cookieを再構築するため、
 *   先にappendしたヘッダーが上書きされる）
 */
export function appendLegacyCookieDelete(response: NextResponse, cookieName: string): void {
  const secure = process.env.NODE_ENV === 'production'
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (secure) parts.push('Secure')
  response.headers.append('Set-Cookie', parts.join('; '))
}
