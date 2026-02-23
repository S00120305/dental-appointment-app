// TODO: 来院ステータスバッジ
export default function StatusBadge({ status }: { status?: string }) {
  return <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{status ?? '未設定'}</span>
}
