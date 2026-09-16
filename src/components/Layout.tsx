"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  LinkIcon,
  QueueListIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useClientSession, type Session } from "@/lib/session";
import { fallbackEventName } from "@/lib/event";
import EventBrand from "./EventBrand";
import { EventPicker } from "./EventProvider";
import { usePoll } from "@/lib/usePoll";
import { eventOrEmpty, logout, settingsOrDefaults } from "@/lib/bt";

import { PHASE_LABELS } from "@/lib/ux";

const hasUnsaved = () => !!document.querySelector('[data-unsaved="true"]');
const canLeave = () =>
  !hasUnsaved() || window.confirm("Leave without saving your changes?");

type Role = Session["role"] | "guest";

type NavItem = {
  name: string;
  href: string;
  hint: string;
  icon: ComponentType<ComponentProps<"svg">>;
  match: RegExp;
};

type NavSection = {
  name: string;
  items: NavItem[];
};

const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  admin: [
    {
      name: "Event Controls",
      items: [
        {
          name: "Events",
          href: "/admin/events",
          hint: "Choose or create an event",
          icon: CalendarDaysIcon,
          match: /^\/admin\/events$/,
        },
        {
          name: "Dashboard",
          href: "/admin",
          hint: "Overview and quick access",
          icon: HomeIcon,
          match: /^\/admin$/,
        },
        {
          name: "Event Settings",
          href: "/admin/settings",
          hint: "Phase, locks, and visibility",
          icon: Cog6ToothIcon,
          match: /^\/admin\/settings$/,
        },
        {
          name: "Judges",
          href: "/admin/judges",
          hint: "Manage judge profiles",
          icon: UserGroupIcon,
          match: /^\/admin\/judges$/,
        },
        {
          name: "Teams",
          href: "/admin/teams",
          hint: "Edit team records and links",
          icon: ClipboardDocumentListIcon,
          match: /^\/admin\/teams(?:\/.*)?$/,
        },
        {
          name: "Assignments",
          href: "/admin/assign",
          hint: "Exceptions: who skips what",
          icon: AdjustmentsHorizontalIcon,
          match: /^\/admin\/assign$/,
        },
        {
          name: "Schedule",
          href: "/admin/schedule",
          hint: "Rooms, blocks, who presents when",
          icon: CalendarDaysIcon,
          match: /^\/admin\/schedule$/,
        },
        {
          name: "Rubric",
          href: "/admin/rubric",
          hint: "Criteria and weighting",
          icon: ClipboardDocumentCheckIcon,
          match: /^\/admin\/rubric$/,
        },
      ],
    },
    {
      name: "Operations",
      items: [
        {
          name: "Links Manager",
          href: "/admin/links",
          hint: "Team demo and repo links",
          icon: LinkIcon,
          match: /^\/admin\/links$/,
        },
        {
          name: "Finals Setup",
          href: "/admin/finals",
          hint: "Final judge/team workflow",
          icon: TrophyIcon,
          match: /^\/admin\/finals$/,
        },
        {
          name: "Live Results",
          href: "/results",
          hint: "Leaderboard and detail views",
          icon: ChartBarSquareIcon,
          match: /^\/results$/,
        },
      ],
    },
  ],
  judge: [
    {
      name: "Judging",
      items: [
        {
          name: "Assigned Teams",
          href: "/judge",
          hint: "Review your prelim queue",
          icon: QueueListIcon,
          match: /^\/judge(?:\/(?!finals(?:\/|$)|rubric(?:\/|$))[^/]+)?$/,
        },
        {
          name: "Schedule",
          href: "/schedule",
          hint: "Your room, block by block",
          icon: CalendarDaysIcon,
          match: /^\/schedule$/,
        },
        {
          name: "Rubric",
          href: "/judge/rubric",
          hint: "Scoring reference",
          icon: ClipboardDocumentCheckIcon,
          match: /^\/judge\/rubric$/,
        },
        {
          name: "Finals Queue",
          href: "/judge/finals",
          hint: "Final round scoring",
          icon: TrophyIcon,
          match: /^\/judge\/finals(?:\/.*)?$/,
        },
        {
          name: "Results",
          href: "/results",
          hint: "Current leaderboard",
          icon: ChartBarSquareIcon,
          match: /^\/results$/,
        },
      ],
    },
  ],
  team: [
    {
      name: "Team Workspace",
      items: [
        {
          name: "Submission",
          href: "/submit",
          hint: "Project links, summary, assets",
          icon: ClipboardDocumentCheckIcon,
          match: /^\/submit(?:\/.*)?$/,
        },
        {
          name: "Schedule",
          href: "/schedule",
          hint: "When and where you present",
          icon: CalendarDaysIcon,
          match: /^\/schedule$/,
        },
        {
          name: "My Feedback",
          href: "/team/feedback",
          hint: "Judge notes and scores",
          icon: ClipboardDocumentListIcon,
          match: /^\/team\/feedback$/,
        },
      ],
    },
  ],
  guest: [
    {
      name: "Portal",
      items: [
        {
          name: "Sign In",
          href: "/auth",
          hint: "Admin, judge, or team access",
          icon: ShieldCheckIcon,
          match: /^\/auth$/,
        },
      ],
    },
  ],
};

const AVATAR: Record<Role, string> = {
  admin: "/org-avatar.svg",
  judge: "/judge-avatar.svg",
  team: "/default-avatar.svg",
  guest: "/default-avatar.svg",
};

function roleFromSession(session: Session | null): Role {
  return session?.role ?? "guest";
}

function homeHrefForRole(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "judge") return "/judge";
  if (role === "team") return "/submit";
  return "/auth";
}

function roleDisplayName(session: Session | null) {
  if (!session) return "Not signed in";
  if (session.role === "admin")
    return session.name || session.id || "Organizer";
  if (session.role === "judge") return session.name || "Judge";
  return session.name || "Team";
}

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, session } = useClientSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Polled so a phase change by an organizer shows up in every open tab. Re-fetched when the
  // session changes, because what settingsOrDefaults may read depends on who is signed in.
  const { data: event } = usePoll(
    async () =>
      session
        ? eventOrEmpty()
        : { settings: await settingsOrDefaults(), links: [] },
    [session?.role, session?.id],
    15000,
  );
  const settings = event?.settings;
  const eventName = settings?.eventName?.trim() || fallbackEventName();
  const phase = settings?.phase ?? "";
  const showTeamFeedback = settings?.showTeamFeedback !== false;

  const rawPath = router.asPath.split("?")[0];
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;
  const role = roleFromSession(session);
  const showJudgeFinals =
    phase === "finals" &&
    !!session &&
    !!settings?.finalsJudgeIds.includes(session.id);
  const sections = useMemo(() => {
    const base = NAV_BY_ROLE[role];
    return base.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (
          role === "judge" &&
          !showJudgeFinals &&
          item.href === "/judge/finals"
        ) {
          return false;
        }
        if (
          role === "team" &&
          !showTeamFeedback &&
          item.href === "/team/feedback"
        ) {
          return false;
        }
        return true;
      }),
    }));
  }, [role, showJudgeFinals, showTeamFeedback]);
  const flatItems = sections.flatMap((section) => section.items);
  const activeItem = flatItems.find((item) => item.match.test(path)) || null;
  const pageTitle = activeItem?.name || eventName;

  function signOut() {
    if (!canLeave()) return;
    document
      .querySelectorAll('[data-unsaved="true"]')
      .forEach((el) => el.setAttribute("data-unsaved", "false"));
    void logout().finally(() => router.replace("/auth"));
  }

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onLink = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        a.target === "_blank" ||
        a.download
      )
        return;
      if (
        a.origin === location.origin &&
        a.pathname === location.pathname &&
        a.search === location.search
      )
        return;
      if (!canLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, []);

  const accountLabel = useMemo(() => roleDisplayName(session), [session]);

  const SidebarItems = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full w-full flex-col">
      <div
        className={[
          "flex items-center justify-between border-b border-white/[0.08]",
          mobile ? "gap-2 pb-4 pr-3" : "gap-3 pb-5",
        ].join(" ")}
      >
        <Link
          href={homeHrefForRole(role)}
          onClick={() => mobile && setSidebarOpen(false)}
          className="inline-flex items-center"
        >
          <div>
            <EventBrand
              name={eventName}
              imageUrl={settings?.imageUrl}
              className="mb-2 h-10 w-auto"
            />
            <p className="text-base font-semibold tracking-tight text-white">
              {eventName}
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Judging Portal
            </p>
          </div>
        </Link>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md border border-white/10 p-1.5 text-slate-300 hover:bg-white/5"
          >
            <span className="sr-only">Close menu</span>
            <XMarkIcon className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {role !== "guest" && (
        <div className="mt-4">
          <EventPicker />
        </div>
      )}
      <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.name}>
            <p
              className={[
                "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500",
                mobile ? "pr-3" : "",
              ].join(" ")}
            >
              {section.name}
            </p>
            <ul className={["space-y-1", mobile ? "w-full" : ""].join(" ")}>
              {section.items.map((item) => {
                const active = item.match.test(path);
                return (
                  <li key={item.href} className={mobile ? "w-full" : undefined}>
                    <Link
                      href={item.href}
                      onClick={() => mobile && setSidebarOpen(false)}
                      className={[
                        "group flex items-center gap-3 rounded-md px-3 py-2.5 transition",
                        mobile ? "w-full" : "",
                        active
                          ? "bg-white/[0.05] text-white"
                          : "text-slate-300 hover:bg-white/[0.03] hover:text-white",
                      ].join(" ")}
                    >
                      <item.icon
                        className={[
                          "size-4 shrink-0",
                          active
                            ? "text-cyan-200"
                            : "text-slate-500 group-hover:text-slate-200",
                        ].join(" ")}
                      />
                      <span className="block min-w-0 truncate text-sm font-medium">
                        {item.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!!event?.links.length && (
        <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs text-slate-500">Event links</p>
          {event.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-slate-300 hover:text-white"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      )}
      <div
        className={[
          "mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-5",
          mobile ? "pr-3" : "",
        ].join(" ")}
      >
        <img
          src={AVATAR[role]}
          alt=""
          className="size-9 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Signed In
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-100">
            {accountLabel}
          </p>
        </div>
        {ready && session ? (
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-100 transition hover:bg-white/[0.08]"
          >
            <ArrowRightOnRectangleIcon className="size-4" />
          </button>
        ) : (
          <Link
            href="/auth"
            onClick={() => mobile && setSidebarOpen(false)}
            className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050505] text-slate-100">
      <div className="pointer-events-none absolute inset-0"></div>

      <Dialog
        open={sidebarOpen}
        onClose={setSidebarOpen}
        className="relative z-50 xl:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-[rgba(5,5,5,0.16)] backdrop-blur-xl transition-opacity duration-200 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative flex h-full w-full transform transition duration-200 data-[closed]:-translate-x-full"
          >
            <div className="m-0 flex h-full w-[15.25rem] max-w-[calc(100vw-1rem)] shrink-0 border-r border-white/10 bg-[#0b0b0c]/96 py-5 pl-3 pr-0 shadow-[24px_0_60px_rgba(0,0,0,0.34)]">
              <SidebarItems mobile />
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex-1 bg-transparent"
            >
              <span className="sr-only">Close navigation</span>
            </button>
          </DialogPanel>
        </div>
      </Dialog>

      <div className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:flex xl:w-[18.5rem] xl:flex-col">
        <div className="flex grow border-r border-white/10 bg-[#0b0b0c]/94 px-5 py-6 shadow-[18px_0_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="w-full">
            <SidebarItems />
          </div>
        </div>
      </div>

      <div className="relative z-10 xl:pl-[18.5rem]">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/92 backdrop-blur-xl xl:hidden">
          <div className="flex items-center gap-3 px-3 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.04] p-2 text-slate-100 transition hover:bg-white/[0.08]"
            >
              <span className="sr-only">Open navigation</span>
              <Bars3Icon className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {pageTitle}
              </p>
              <p className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">
                {eventName}
              </p>
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-7xl px-3 pb-10 pt-6 sm:px-6 sm:pt-7 lg:px-8">
          {role === "admin" &&
            settings &&
            path !== "/admin" &&
            path !== "/admin/events" && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
                <span>
                  Current phase: <strong>{PHASE_LABELS[settings.phase]}</strong>
                </span>
                <Link href="/admin#phase" className="font-semibold underline">
                  Manage phase →
                </Link>
              </div>
            )}
          {children}
        </main>
      </div>
    </div>
  );
}
