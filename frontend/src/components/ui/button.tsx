import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "destructive" };

export function Button({ variant = "default", className = "", ...props }: ButtonProps) {
  const variantClass = variant === "secondary" ? "secondary" : variant === "destructive" ? "danger" : "";
  return <button className={`button ${variantClass} ${className}`.trim()} {...props} />;
}
