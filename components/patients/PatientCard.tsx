'use client'

import type { Patient } from '@/lib/supabase/types'
import { getPatientTagIcons } from '@/lib/constants/patient-tags'

type PatientCardProps = {
  patient: Patient
  onClick: () => void
}

export default function PatientCard({ patient, onClick }: PatientCardProps) {
  const tags = getPatientTagIcons(patient)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {patient.chart_number}
            </span>
            <span className="truncate text-base font-medium text-gray-900">{patient.name}</span>
            {tags.length > 0 && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    title={tag.label}
                    style={{ color: tag.color }}
                    className={`text-sm ${tag.label === '\u611F\u67D3\u6CE8\u610F' ? 'rounded bg-purple-100 px-1' : ''}`}
                  >
                    {tag.icon}
                  </span>
                ))}
              </span>
            )}
          </div>
          {patient.name_kana && (
            <p className="mt-1 text-sm text-gray-500">{patient.name_kana}</p>
          )}
          {patient.phone && (
            <p className="mt-1 text-sm text-gray-500">{patient.phone}</p>
          )}
        </div>
        <svg
          className="ml-2 h-5 w-5 flex-shrink-0 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
