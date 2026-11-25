import { FAMILY_COPY } from "@/lib/copy";

export type MemberListItem = { id: string; name: string; color: string; isOwner: boolean };

/** The adults of a family, with a color dot and an "Owner" label on the owner. */
export function MemberList({ members }: { members: MemberListItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {members.map((member) => (
        <li key={member.id} className="flex min-h-11 items-center gap-3 px-4 py-2">
          <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full"
            style={{ backgroundColor: member.color }}
          />
          <span className="flex-1">{member.name}</span>
          {member.isOwner ? (
            <span className="text-sm text-muted-foreground">{FAMILY_COPY.ownerLabel}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
