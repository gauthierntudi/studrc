import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Classe Bootstrap legacy `form-control` */
export function Input({ className, ...props }: InputProps) {
  return <input className={cn("form-control", className)} {...props} />;
}
