import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "./field-error";

type TextFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
};

/** A labelled input that points at its own error text for screen readers. */
export function TextField({ name, label, error, ...props }: TextFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
