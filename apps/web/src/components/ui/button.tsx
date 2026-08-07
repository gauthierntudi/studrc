import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Boutons style legacy : KelsonBd, radius 0, cyan #02d0d1 */
const buttonVariants = cva("btn btn-sm", {
  variants: {
    variant: {
      default: "",
      outline: "",
      ghost: "",
      danger: "",
    },
    size: {
      default: "",
      sm: "btn-sm",
      lg: "btn-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const variantStyle: Record<string, React.CSSProperties> = {
  default: {
    color: "#212121",
    backgroundColor: "#02d0d1",
    fontFamily: "KelsonBd",
    borderRadius: 0,
    textTransform: "uppercase",
  },
  outline: {
    color: "#212121",
    backgroundColor: "transparent",
    border: "1px solid #212121",
    fontFamily: "KelsonBd",
    borderRadius: 0,
    textTransform: "uppercase",
  },
  ghost: {
    color: "#212121",
    backgroundColor: "transparent",
    fontFamily: "KelsonBd",
    borderRadius: 0,
    textTransform: "uppercase",
  },
  danger: {
    color: "#fff",
    backgroundColor: "#e9262a",
    fontFamily: "KelsonBd",
    borderRadius: 0,
    textTransform: "uppercase",
  },
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, style, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ ...variantStyle[variant ?? "default"], ...style }}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";
