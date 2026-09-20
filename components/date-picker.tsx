"use client"

import { CalendarIcon } from "lucide-react"

import { formatDateOnly } from "@/lib/date"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { type FC } from "react"

interface CalendarFormProps {
  selectedDate?: Date
  onDateChange: (date?: Date) => void
}

export const CalendarForm: FC<CalendarFormProps> = ({ selectedDate, onDateChange }) => {
  const date = selectedDate;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "pl-3 text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          {date ? (
            formatDateOnly(date, "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          ) : (
            <span>Pick a date</span>
          )}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          timeZone="UTC"
          selected={date}
          onSelect={(newDate) => {
            // ! newDate is already 00:00:00 UTC
            onDateChange(newDate)
          }}
          disabled={(date) =>
            date > new Date() || date < new Date("2024-09-05")
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
