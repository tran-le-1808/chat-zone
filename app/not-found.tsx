"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef5f3] p-4">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* LEFT SIDE */}
        <div className="hidden w-1/2 flex-col items-center justify-center bg-gradient-to-b from-cyan-400 to-purple-500 p-12 text-white md:flex">
          <div className="flex flex-col items-center">
            <div className="mb-6 text-8xl">🚫</div>

            <h1 className="mb-10 text-6xl font-bold">404</h1>

            <p className="max-w-sm text-center text-3xl font-light leading-relaxed">
              Oops! The page you are looking for does not exist
            </p>

            <div className="mt-16 text-center">
              <div className="mb-3 text-6xl">🌍</div>

              <p className="text-4xl font-light">Lost in Space!</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex w-full items-center justify-center bg-white px-8 py-14 md:w-1/2">
          <div className="w-full max-w-md text-center">
            <div className="mb-8 text-8xl font-bold text-cyan-400">404</div>

            <h2 className="mb-6 text-5xl font-light tracking-wide text-gray-700">
              Page Not Found
            </h2>

            <p className="mb-12 text-lg leading-relaxed text-gray-500">
              The page you requested could not be found. It may have been moved,
              deleted, or the URL is incorrect.
            </p>

            <button
              onClick={() => router.push("/")}
              className="w-full rounded-md bg-gradient-to-r from-cyan-400 to-purple-400 py-4 text-2xl font-light text-white transition hover:opacity-90"
            >
              Go Home
            </button>

            <p className="mt-8 text-gray-400">Chat Zone © 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
