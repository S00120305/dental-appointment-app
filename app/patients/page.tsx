'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PatientCard from '@/components/patients/PatientCard'
import PatientForm from '@/components/patients/PatientForm'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import type { Patient } from '@/lib/supabase/types'

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPatients = useCallback(async (query: string) => {
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : ''
      const res = await fetch(`/api/patients${params}`)
      const data = await res.json()
      if (res.ok) {
        setPatients(data.patients)
      }
    } catch {
      // エラー時は空表示
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients('')
  }, [fetchPatients])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetchPatients(value)
    }, 300)
  }

  function handleNewPatient() {
    setSelectedPatient(null)
    setModalOpen(true)
  }

  function handleEditPatient(patient: Patient) {
    setSelectedPatient(patient)
    setModalOpen(true)
  }

  function handleSaved() {
    fetchPatients(search)
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">患者一覧</h1>
          <Button onClick={handleNewPatient}>新規登録</Button>
        </div>

        {/* 検索バー */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="カルテNo / 氏名 / フリガナで検索"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* 患者一覧 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">
              {search ? '検索条件に一致する患者がいません' : '患者が登録されていません'}
            </p>
            {!search && (
              <p className="mt-2 text-sm text-gray-400">
                「新規登録」ボタンまたは設定の「CSVインポート」から患者を追加できます
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onClick={() => handleEditPatient(patient)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 登録・編集モーダル */}
      <PatientForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        patient={selectedPatient}
      />
    </AppLayout>
  )
}
