"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { CalendarForm } from "./date-picker"

interface DatePickerWrapperProps {
  selectedDate: Date
}

export default function DatePickerWrapper({ selectedDate }: DatePickerWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDateChange = (newDate?: Date) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))

    newDate ??= new Date()
    const localDateString = newDate.getFullYear() + '-' +
      String(newDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(newDate.getDate()).padStart(2, '0');
    current.set("date", localDateString);

    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`${query}`)
  }

  return (
    // Put at the end of the grid-cols-12
    <div>
      <CalendarForm selectedDate={selectedDate} onDateChange={handleDateChange} />
    </div>
  )
}

