"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Images, Plus, RefreshCw } from "lucide-react";
import { getActivityMomentsAction } from "@/features/activities/actions";
import type {
  ActivityMediaDTO,
  ActivitySummaryDTO,
} from "@/features/activities/types";

export function ActivityMoments({
  activities,
}: {
  activities: Pick<
    ActivitySummaryDTO,
    "id" | "title" | "coverUrl" | "mediaCount"
  >[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [media, setMedia] = useState<ActivityMediaDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  const albums = activities.filter(
    (activity) => (activity.mediaCount || 0) > 0 || activity.coverUrl,
  );
  const selected = activities.find((activity) => activity.id === selectedId);

  function loadAlbum(activityId: string, append = false) {
    const requestId = ++request.current;
    const offset = append ? media.length : 0;
    setSelectedId(activityId);
    setError(null);
    if (!append) {
      setMedia([]);
      setHasMore(false);
    }
    startTransition(async () => {
      try {
        const result = await getActivityMomentsAction(activityId, offset);
        if (request.current !== requestId) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        setMedia((previous) =>
          append
            ? [...previous, ...result.media].filter(
                (photo, index, all) =>
                  all.findIndex((candidate) => candidate.id === photo.id) ===
                  index,
              )
            : result.media,
        );
        setHasMore(result.hasMore);
      } catch {
        if (request.current === requestId)
          setError("Moments could not be loaded. Please retry.");
      }
    });
  }

  return (
    <section className="space-y-5" aria-label="Activity moments">
      {albums.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {albums.map((activity) => (
            <button
              key={activity.id}
              type="button"
              aria-label={`Open moments for ${activity.title}`}
              aria-pressed={selectedId === activity.id}
              onClick={() => loadAlbum(activity.id)}
              className={`min-w-0 overflow-hidden rounded-lg border bg-white text-left hover:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-[#161B26] ${selectedId === activity.id ? "border-emerald-500" : "border-[#EDEDF2] dark:border-slate-800"}`}
            >
              {activity.coverUrl ? (
                <Image
                  unoptimized
                  src={activity.coverUrl}
                  alt=""
                  width={640}
                  height={480}
                  loading="lazy"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <Images
                    className="h-6 w-6 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="space-y-1 p-3">
                <h2 className="line-clamp-2 min-h-10 break-words text-sm font-semibold text-[#111625] dark:text-white">
                  {activity.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {activity.mediaCount ?? 0} photos
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">
          No moments match these filters.
        </p>
      )}

      {selected && (
        <div className="space-y-4 border-t border-[#EDEDF2] pt-5 dark:border-slate-800">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 break-words text-base font-semibold text-[#111625] dark:text-white">
              {selected.title}
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={pending}
                aria-label="Refresh album"
                title="Refresh album"
                onClick={() => loadAlbum(selected.id)}
                className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <Link
                href={`/project-center/${selected.id}?tab=media`}
                className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
              >
                Open project media
              </Link>
            </div>
          </header>
          {pending && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-slate-500"
            >
              Loading moments...
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-rose-600">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending && media.length === 0
              ? Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="aspect-[4/3] rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                ))
              : media.map((photo) => (
                  <figure
                    key={photo.id}
                    className="min-w-0 overflow-hidden rounded-lg border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
                  >
                    {photo.url ? (
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View photo: ${photo.caption || selected.title}`}
                      >
                        <Image
                          unoptimized
                          src={photo.url}
                          alt={photo.caption || selected.title}
                          width={800}
                          height={600}
                          loading="lazy"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="aspect-[4/3] w-full bg-slate-50 object-contain dark:bg-slate-900"
                        />
                      </a>
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-500">
                        Preview unavailable
                      </div>
                    )}
                    {photo.caption && (
                      <figcaption className="break-words p-3 text-xs text-slate-600 dark:text-slate-300">
                        {photo.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
          </div>
          {!pending && !error && media.length === 0 && (
            <p className="text-xs text-slate-500">
              No photos in this album yet.
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              disabled={pending}
              onClick={() => loadAlbum(selected.id, true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Load more photos
            </button>
          )}
        </div>
      )}
    </section>
  );
}
