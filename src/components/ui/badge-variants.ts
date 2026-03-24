import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-stitch-primary text-white hover:bg-stitch-primary/90 shadow-sm",
        secondary:
          "border-transparent bg-stitch-secondary-container text-stitch-on-secondary-container hover:bg-stitch-secondary-container/80",
        destructive:
          "border-transparent bg-stitch-error text-white hover:bg-stitch-error/80",
        outline: "text-stitch-on-surface border-stitch-outline-variant/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
