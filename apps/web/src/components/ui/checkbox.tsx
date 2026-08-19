import { Checkbox } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

function CheckboxRoot({
  className,
  ...props
}: Checkbox.Root.Props) {
  return (
    <Checkbox.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <Checkbox.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5 opacity-0 group-data-[checked]/checkbox:opacity-100" strokeWidth={3} />
        <Minus className="size-3.5 opacity-0 group-data-[indeterminate]/checkbox:opacity-100" strokeWidth={3} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

export { CheckboxRoot as Checkbox }
