// Shows current principal type (anon or signed-in user)
interface PrincipalBadgeProps { principalType: "anon" | "user"; }
export default function PrincipalBadge({ principalType }: PrincipalBadgeProps) {
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-gray-200">
      {principalType === "anon" ? "Guest" : "Signed in"}
    </span>
  );
}
