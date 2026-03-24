import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import { buttonVariants } from "./button-variants"

// Interface das Props do Botão
// Extende as props nativas do HTMLButtonElement e as variantes definidas acima
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean // Se true, renderiza o filho como elemento raiz (útil para Slots do Radix UI)
}

// Componente Button
// forwardRef permite que o componente receba uma ref externa (necessário para alguns componentes do Radix/React Hook Form)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Se asChild for true, usa o Slot do Radix, senão usa a tag 'button' padrão
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        // cn() combina as classes geradas pelo cva com classes customizadas passadas via props
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button" // Nome para devtools

export { Button }
