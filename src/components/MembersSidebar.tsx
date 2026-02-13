import type { MemberItem } from "./types";

type MembersSidebarProps = {
  members: MemberItem[];
};

export default function MembersSidebar({ members }: MembersSidebarProps) {
  return (
    <aside className="w-60 shrink-0 border-l border-zinc-800 bg-zinc-900 p-4">
      {/* Online members panel */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Online — {members.length}
      </h2>
      <ul className="mt-4 space-y-2 overflow-y-auto">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
          >
            <span className="h-6 w-6 rounded-full border border-zinc-600 bg-zinc-700" />
            <span className="text-sm">{member.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
