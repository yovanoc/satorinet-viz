"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatDateParam } from "@/lib/date-param";
import { CalendarForm } from "./date-picker";

interface DatePickerWrapperProps {
  selectedDate: Date;
}

export default function DatePickerWrapper({
  selectedDate,
}: DatePickerWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (newDate?: Date) => {
    if (!searchParams) return;
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    current.delete("offset");
    newDate ??= new Date();
    current.set("date", formatDateParam(newDate));

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${query}`);
  };

  return (
    <CalendarForm selectedDate={selectedDate} onDateChange={handleDateChange} />
  );
}
