// TODO: 技工物納品状況バッジ
export default function LabOrderBadge({ status }: { status?: string }) {
  return <span className="text-xs">🦷 {status ?? '未設定'}</span>
}
