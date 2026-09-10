import Link from "next/link";

export default function JudgeNav({
  judgeName,
  progress
}: {
  judgeName: string;
  progress: string;
}) {
  return (
    <header>
      <nav className="flex overflow-x-auto border-b border-gray-200 py-4 dark:border-white/10">
        <ul className="flex min-w-full flex-none gap-x-6 px-4 text-sm/6 font-semibold text-gray-500 sm:px-6 lg:px-8 dark:text-gray-400">
          <li>
            <Link href="/judge">Overview</Link>
          </li>
          <li>
            <Link href="/results">Results</Link>
          </li>
          <li>
            <Link href="/admin">Admin</Link>
          </li>
        </ul>
      </nav>
      <div className="flex flex-col items-start justify-between gap-4 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:bg-gray-700/10">
        <div>
          <div className="flex items-center gap-x-3">
            <div className="flex-none rounded-full bg-green-500/10 p-1 text-green-500 dark:bg-green-400/10 dark:text-green-400">
              <div className="size-2 rounded-full bg-current" />
            </div>
            <h1 className="text-base/7 font-semibold text-gray-900 dark:text-white">
              Welcome, {judgeName}
            </h1>
          </div>
          <p className="mt-2 text-xs/6 text-gray-500 dark:text-gray-400">
            Progress: {progress}
          </p>
        </div>
        <div className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-500 ring-1 ring-indigo-200 ring-inset dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30">
          Judge
        </div>
      </div>
    </header>
  );
}
