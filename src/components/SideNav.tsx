"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: "grid" | "shield" }) {
  const pathname = usePathname();
  return (
    <Link href={href} className={`nav-link${pathname === href ? " active" : ""}`}>
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}
