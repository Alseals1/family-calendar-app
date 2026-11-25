import { CalendarDays } from "lucide-react";
import { APP_NAME } from "@/lib/copy";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-center gap-2 text-primary">
        <CalendarDays aria-hidden="true" className="size-6" />
        <span className="text-lg font-semibold">{APP_NAME}</span>
      </div>
      {children}
    </main>
  );
}
