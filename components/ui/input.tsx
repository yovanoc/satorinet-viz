import * as React from "react"

import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-base border-2 text-text font-base selection:bg-main selection:text-mtext border-border bg-bw px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
Input.displayName = "Input"

export { Input }
