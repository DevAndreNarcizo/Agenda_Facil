import { Toaster as Sonner } from "sonner"
import { useThemeMode } from "@/hooks/use-theme-mode"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toasts no padrão do design system: pílula navy (tinta) centralizada embaixo, ícone de status
 * e tema sincronizado com useThemeMode (antes dependia de next-themes sem provider).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { mode } = useThemeMode()

  return (
    <Sonner
      theme={mode}
      position="bottom-center"
      offset={28}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast af-root !w-auto !min-w-0 !max-w-[min(480px,calc(100vw-32px))] !rounded-lg !border-0 !bg-af-ink !px-3.5 !py-2.5 !text-[13px] !text-af-bg !shadow-[0_12px_32px_-12px_rgba(9,35,67,0.45)]",
          title: "!font-medium",
          description: "!text-af-bg !opacity-80",
          actionButton: "!bg-af-accent !text-af-on-accent",
          cancelButton: "!bg-transparent !text-af-bg",
          icon: "!text-af-bg",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
