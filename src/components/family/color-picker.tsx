import { Check } from "lucide-react";
import { MEMBER_COLORS } from "@/lib/colors/palette";
import { COLOR_NAMES, FAMILY_COPY } from "@/lib/copy";
import { FieldError } from "@/components/auth/field-error";

type ColorPickerProps = { defaultValue: string; error?: string };

/**
 * The palette as a radio group. Each swatch is a native radio labelled by its color name,
 * so it works with a keyboard and a screen reader. The swatch fill is the only place a hex
 * reaches the DOM, and the selected swatch shows a check mark, never text on the color.
 */
export function ColorPicker({ defaultValue, error }: ColorPickerProps) {
  const errorId = "color-error";
  return (
    <fieldset
      role="radiogroup"
      aria-label={FAMILY_COPY.colorLabel}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-1.5"
    >
      <legend className="mb-1.5 text-sm font-medium">{FAMILY_COPY.colorLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {MEMBER_COLORS.map(({ id, hex }) => (
          <label
            key={id}
            className="relative flex size-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            style={{ backgroundColor: hex }}
          >
            <input
              type="radio"
              name="color"
              value={hex}
              defaultChecked={hex === defaultValue}
              aria-label={COLOR_NAMES[id]}
              className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full checked:ring-2 checked:ring-offset-2 checked:ring-foreground"
            />
            <Check
              aria-hidden="true"
              className="pointer-events-none size-5 text-white opacity-0 peer-checked:opacity-100"
            />
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
