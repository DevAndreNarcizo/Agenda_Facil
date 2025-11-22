import { cn } from "@/lib/utils"

// Componente Skeleton: Usado para criar placeholders visuais de carregamento
// Ele exibe uma caixa cinza pulsante para indicar que o conteúdo está sendo carregado
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // 'animate-pulse': Adiciona a animação de pulso nativa do Tailwind
      // 'rounded-md': Bordas arredondadas
      // 'bg-muted': Cor de fundo sutil (geralmente cinza claro/escuro dependendo do tema)
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
