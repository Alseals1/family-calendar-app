import { CalendarDays } from "lucide-react";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/copy";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <CalendarDays aria-hidden="true" className="size-12 text-primary" />
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-muted-foreground">{APP_DESCRIPTION}</p>
    </main>
  );
}
