"use client"

import type { ComponentType } from "react"
import { CheckIcon, PlusCircleIcon } from "lucide-react"
import type { RowData } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

import type { AppColumn } from "./features"

export interface FilterOption {
  label: string
  value: string
  icon?: ComponentType<{ className?: string }>
}

export function DataTableFacetedFilter<TData extends RowData>({
  column,
  title,
  options,
}: {
  column: AppColumn<TData>
  title: string
  options: FilterOption[]
}) {
  const facets = column.getFacetedUniqueValues()
  const raw = column.getFilterValue()
  const selected = new Set(Array.isArray(raw) ? (raw as string[]) : [])

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    const values = Array.from(next)
    column.setFilterValue(values.length ? values : undefined)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-8 border-dashed" />}
      >
        <PlusCircleIcon aria-hidden />
        {title}
        {selected.size > 0 && (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
              {selected.size}
            </Badge>
            <div className="hidden gap-1 lg:flex">
              {selected.size > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selected.size} selected
                </Badge>
              ) : (
                options
                  .filter((o) => selected.has(o.value))
                  .map((o) => (
                    <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">
                      {o.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} aria-label={`Filter options for ${title}`} />
          <CommandList>
            <CommandEmpty>No matching options.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value)
                const Icon = option.icon
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                      aria-hidden
                    >
                      {isSelected && <CheckIcon className="size-3" />}
                    </div>
                    {Icon && <Icon className="size-4 text-muted-foreground" />}
                    <span className="truncate">{option.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                      {facets.get(option.value) ?? 0}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => column.setFilterValue(undefined)} className="justify-center">
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
