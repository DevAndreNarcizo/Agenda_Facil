import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Definição das Variantes do Botão usando 'class-variance-authority' (cva)
// Isso permite criar múltiplas combinações de estilos (variant, size) de forma declarativa
const buttonVariants = cva(
  // Estilos base aplicados a todos os botões
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      // Estilos visuais (cores, bordas)
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90", // Cor principal
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90", // Ações perigosas (ex: deletar)
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground", // Borda fina
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", // Cor secundária
        ghost: "hover:bg-accent hover:text-accent-foreground", // Sem fundo, apenas hover
        link: "text-primary underline-offset-4 hover:underline", // Parece um link
      },
      // Tamanhos disponíveis
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10", // Quadrado para ícones
      },
    },
    // Valores padrão caso não sejam informados
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

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

export { Button, buttonVariants }
