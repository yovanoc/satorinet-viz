"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState, type FC } from "react"

interface CalendarFormProps {
  selectedDate?: Date
  onDateChange: (date?: Date) => void
}

export const CalendarForm: FC<CalendarFormProps> = ({ selectedDate, onDateChange }) => {
  const [date, setDate] = useState(selectedDate);

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
            format(date, "PPP")
          ) : (
            <span>Pick a date</span>
          )}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            // ! newDate is already 00:00:00 UTC
            setDate(newDate)
            onDateChange(newDate)
          }}
          disabled={(date) =>
            date > new Date() || date < new Date("2024-09-05")
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
