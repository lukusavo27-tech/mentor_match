export default function UserAvatar({ name = "Tillen Otuoma", size = "md" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const dimensions = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return <span aria-label={`${name} profile`} title={name} className={`grid shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-800 ${dimensions}`}>{initials || "?"}</span>;
}
