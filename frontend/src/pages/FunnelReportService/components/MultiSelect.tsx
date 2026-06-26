import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"

export interface MultiSelectOption {
    value: string
    label: string
}

interface MultiSelectProps {
    options: MultiSelectOption[]
    selected: string[]
    onChange: (selected: string[]) => void
    placeholder: string
    width?: string
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder,
    width = "w-[180px]",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 выбран"
        : `${selected.length} выбрано`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors text-sm text-gray-700",
            width
          )}
        >
          <span className="truncate">{label}</span>
          {selected.length > 0 ? (
            <X
              className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange([]) }}
            />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-1", width)} align="start">
        <div className="max-h-60 overflow-y-auto">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={() => toggle(option.value)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 transition-colors"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-4 h-4 rounded border shrink-0",
                  isSelected ? "bg-primary border-primary" : "border-gray-300"
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              {option.label}
            </button>
          )
        })}
        </div>
      </PopoverContent>
    </Popover>
  )
}