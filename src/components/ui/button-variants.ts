import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-stitch-md text-sm font-bold ring-offset-stitch-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-stitch-primary text-stitch-on-primary hover:bg-stitch-on-primary-fixed-variant shadow-md",
        destructive: "bg-stitch-error text-stitch-on-error hover:bg-stitch-error/90",
        outline: "border-2 border-stitch-outline-variant bg-transparent text-stitch-on-surface-variant hover:bg-stitch-surface-container hover:text-stitch-on-surface",
        secondary: "bg-stitch-secondary-container text-stitch-on-secondary-container hover:bg-stitch-secondary-container/80",
        ghost: "hover:bg-stitch-surface-container hover:text-stitch-on-surface",
        link: "text-stitch-primary underline-offset-4 hover:underline",
        premium: "bg-stitch-primary-container text-stitch-on-primary-container font-black hover:scale-105 shadow-lg",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-stitch-sm px-4",
        lg: "h-14 rounded-stitch-lg px-10 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
