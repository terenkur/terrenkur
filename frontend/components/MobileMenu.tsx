"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import MainNav from "@/components/MainNav";
import ModeratorStatus from "@/components/ModeratorStatus";
import ThemeToggle from "@/components/ThemeToggle";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node) &&
          !(event.target as Element).closest('[data-radix-popper-content-wrapper]')) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div ref={container} onKeyDown={event => {
      if (open && event.key === "Escape" && !event.defaultPrevented) {
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} className="rounded border px-3 py-2 text-sm lg:hidden"
        aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(!open)}>
        Меню
      </button>
      <div id="site-navigation"
        onClick={event => { if ((event.target as Element).closest("a")) setOpen(false); }}
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-3 border-b bg-background p-4 shadow-lg lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-sm lg:shadow-none`}>
        <MainNav />
        <ThemeToggle />
        <ModeratorStatus />
      </div>
    </div>
  );
}
