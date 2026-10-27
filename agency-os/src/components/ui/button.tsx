import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Роли кнопок (редизайн, этап 1):
 * - default/primary — главное действие экрана, на форме ровно одна;
 * - secondary — второстепенное действие рядом с главным;
 * - outline/ghost — нейтральные действия, «Назад», «Отмена»;
 * - destructive — первая кнопка удаления (контур), destructiveSolid — подтверждение;
 * - ai — передать задачу ИИ.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
        primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
        secondary: "bg-blue-100 text-blue-700 hover:bg-blue-200",
        outline:
          "border border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50",
        ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
        destructive:
          "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
        destructiveSolid: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        ai: "bg-violet-600 text-white shadow-sm hover:bg-violet-700",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
