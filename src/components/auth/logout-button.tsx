import { logOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { AUTH_COPY } from "@/lib/copy";

export function LogoutButton() {
  return (
    <form action={logOut}>
      <Button type="submit" variant="outline">
        {AUTH_COPY.logoutLabel}
      </Button>
    </form>
  );
}
