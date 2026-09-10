import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background,box-shadow,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/70 disabled:pointer-events-none disabled:opacity-50 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        primary:
          "bg-fg text-bg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:opacity-90",
        glow:
          "text-fg bg-gradient-to-r from-cyan-deep/90 via-violet to-magenta shadow-[0_0_24px_rgba(139,124,255,0.35)] hover:brightness-110",
        ghost:
          "text-muted hover:text-fg hover:bg-white/5",
        outline:
          "text-fg shadow-[0_0_0_1px_rgba(148,180,255,0.2)] hover:bg-white/5",
        subtle:
          "bg-white/5 text-fg hover:bg-white/10",
      },
      size: {
        sm: "h-9 rounded-[10px] px-3 text-sm",
        md: "h-11 rounded-[12px] px-4 text-sm",
        lg: "h-12 rounded-[14px] px-5 text-[15px]",
        icon: "size-10 rounded-[12px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
