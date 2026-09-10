"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChartBarSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  LinkIcon,
  QueueListIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useClientSession, clearSession, type Session } from "@/lib/session";
import { DEFAULT_EVENT_NAME } from "@/lib/event";
import { db, EVENT_ID } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

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
          name: "Dashboard",
          href: "/admin",
          hint: "Overview and quick access",
          icon: HomeIcon,
          match: /^\/admin$/
        },
        {
          name: "Event Settings",
          href: "/admin/settings",
          hint: "Phase, locks, and visibility",
          icon: Cog6ToothIcon,
          match: /^\/admin\/settings$/
        },
        {
          name: "Judges",
          href: "/admin/judges",
          hint: "Manage judge profiles",
          icon: UserGroupIcon,
          match: /^\/admin\/judges$/
        },
        {
          name: "Teams",
          href: "/admin/teams",
          hint: "Edit team records and links",
          icon: ClipboardDocumentListIcon,
          match: /^\/admin\/teams(?:\/.*)?$/
        },
        {
          name: "Assignments",
          href: "/admin/assign",
          hint: "Balance judge coverage",
          icon: AdjustmentsHorizontalIcon,
          match: /^\/admin\/assign$/
        },
        {
          name: "Rubric",
          href: "/admin/rubric",
          hint: "Criteria and weighting",
          icon: ClipboardDocumentCheckIcon,
          match: /^\/admin\/rubric$/
        }
      ]
    },
    {
      name: "Operations",
      items: [
        {
          name: "Links Manager",
          href: "/admin/links",
          hint: "Team demo and repo links",
          icon: LinkIcon,
          match: /^\/admin\/links$/
        },
        {
          name: "Finals Setup",
          href: "/admin/finals",
          hint: "Final judge/team workflow",
          icon: TrophyIcon,
          match: /^\/admin\/finals$/
        },
        {
          name: "Seed Teams",
          href: "/admin/seed-teams",
          hint: "Bulk import helper",
          icon: SparklesIcon,
          match: /^\/admin\/seed-teams$/
        },
        {
          name: "Live Results",
          href: "/results",
          hint: "Leaderboard and detail views",
          icon: ChartBarSquareIcon,
          match: /^\/results$/
        }
      ]
    }
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
          match: /^\/judge(?:\/(?!finals(?:\/|$)|rubric(?:\/|$))[^/]+)?$/
        },
        {
          name: "Rubric",
          href: "/judge/rubric",
          hint: "Scoring reference",
          icon: ClipboardDocumentCheckIcon,
          match: /^\/judge\/rubric$/
        },
        {
          name: "Finals Queue",
          href: "/judge/finals",
          hint: "Final round scoring",
          icon: TrophyIcon,
          match: /^\/judge\/finals(?:\/.*)?$/
        },
        {
          name: "Results",
          href: "/results",
          hint: "Current leaderboard",
          icon: ChartBarSquareIcon,
          match: /^\/results$/
        }
      ]
    }
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
          match: /^\/submit(?:\/.*)?$/
        },
        {
          name: "My Feedback",
          href: "/team/feedback",
          hint: "Judge notes and scores",
          icon: ClipboardDocumentListIcon,
          match: /^\/team\/feedback$/
        },
        {
          name: "Results",
          href: "/results",
          hint: "Public standings view",
          icon: ChartBarSquareIcon,
          match: /^\/results$/
        }
      ]
    }
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
          match: /^\/auth$/
        },
        {
          name: "Results",
          href: "/results",
          hint: "Leaderboard and team rankings",
          icon: ChartBarSquareIcon,
          match: /^\/results$/
        }
      ]
    }
  ]
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
  if (session.role === "admin") return session.name || "Admin";
  if (session.role === "judge") return session.name || "Judge";
  return session.name || "Team";
}

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, session } = useClientSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventName, setEventName] = useState(DEFAULT_EVENT_NAME);
  const [phase, setPhase] = useState("");
  const [showTeamFeedback, setShowTeamFeedback] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "events", EVENT_ID),
      (snap) => {
        const data = snap.exists()
          ? (snap.data() as {
              name?: string;
              phase?: string;
              showTeamFeedback?: boolean;
            })
          : undefined;
        setEventName(data?.name?.trim() || DEFAULT_EVENT_NAME);
        setPhase(data?.phase || "");
        setShowTeamFeedback(data?.showTeamFeedback !== false);
      },
      () => {
        setEventName(DEFAULT_EVENT_NAME);
        setPhase("");
        setShowTeamFeedback(true);
      }
    );
    return () => unsub();
  }, []);

  const rawPath = router.asPath.split("?")[0];
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;
  const role = roleFromSession(session);
  const showJudgeFinals = phase === "finals";
  const sections = useMemo(() => {
    const base = NAV_BY_ROLE[role];
    return base.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (role === "judge" && !showJudgeFinals && item.href === "/judge/finals") {
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
      })
    }));
  }, [role, showJudgeFinals, showTeamFeedback]);
  const flatItems = sections.flatMap((section) => section.items);
  const activeItem = flatItems.find((item) => item.match.test(path)) || null;
  const pageTitle = activeItem?.name || eventName;

  function signOut() {
    clearSession();
    router.replace("/auth");
  }

  const accountLabel = useMemo(() => roleDisplayName(session), [session]);

  const SidebarItems = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full w-full flex-col">
      <div
        className={[
          "flex items-center justify-between border-b border-white/[0.08]",
          mobile ? "gap-2 pb-4 pr-3" : "gap-3 pb-5"
        ].join(" ")}
      >
        <Link
          href={homeHrefForRole(role)}
          onClick={() => mobile && setSidebarOpen(false)}
          className="inline-flex items-center"
        >
          <div>
            <p className="text-base font-semibold tracking-tight text-white">{eventName}</p>
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

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.name}>
            <p
              className={[
                "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500",
                mobile ? "pr-3" : ""
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
                          : "text-slate-300 hover:bg-white/[0.03] hover:text-white"
                      ].join(" ")}
                    >
                      <item.icon
                        className={[
                          "size-4 shrink-0",
                          active
                            ? "text-cyan-200"
                            : "text-slate-500 group-hover:text-slate-200"
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

      <div className={["mt-6 border-t border-white/[0.08] pt-5", mobile ? "pr-3" : ""].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Signed In
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-100">
              {accountLabel}
            </p>
          </div>
        </div>
        {ready && session ? (
          <button
            onClick={signOut}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
          >
            <ArrowRightOnRectangleIcon className="size-4" />
            Sign Out
          </button>
        ) : (
          <Link
            href="/auth"
            onClick={() => mobile && setSidebarOpen(false)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050505] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />
      </div>

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
          {children}
        </main>
      </div>
    </div>
  );
}
