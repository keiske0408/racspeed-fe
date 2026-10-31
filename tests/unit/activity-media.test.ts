import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ActivityMoments } from "@/app/(app)/project-center/_components/activity-moments";
import {
  compressActivityPhoto,
  PHOTO_TARGET_BYTES,
  uploadActivityPhotos,
} from "@/features/activities/media-upload";

const mocks = vi.hoisted(() => ({ compress: vi.fn(), moments: vi.fn() }));
vi.mock("browser-image-compression", () => ({ default: mocks.compress }));
vi.mock("@/features/activities/actions", () => ({
  getActivityMomentsAction: mocks.moments,
}));
afterEach(cleanup);

beforeEach(() => {
  mocks.compress.mockReset();
  mocks.moments.mockReset();
  mocks.compress.mockResolvedValue(
    new File(["compressed"], "photo.webp", { type: "image/webp" }),
  );
});

describe("Activity photo compression", () => {
  it("resizes photos, strips metadata and keeps the original file untouched", async () => {
    const original = new File([new Uint8Array(2 * 1024 * 1024)], "camera.jpg", {
      type: "image/jpeg",
    });
    const photo = await compressActivityPhoto(original);
    expect(photo.size).toBeLessThan(PHOTO_TARGET_BYTES);
    expect(photo.type).toBe("image/webp");
    expect(original.size).toBe(2 * 1024 * 1024);
    expect(mocks.compress).toHaveBeenCalledWith(
      original,
      expect.objectContaining({
        maxWidthOrHeight: 1600,
        preserveExif: false,
        useWebWorker: true,
      }),
    );
  });

  it("never submits an oversized compression result", async () => {
    mocks.compress.mockResolvedValue(
      new File([new Uint8Array(PHOTO_TARGET_BYTES + 1)], "large.webp", {
        type: "image/webp",
      }),
    );
    await expect(
      compressActivityPhoto(
        new File(["source"], "photo.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toThrow("could not be reduced");
  });

  it("preserves GIF animation and rejects large GIFs", async () => {
    const gif = new File(["gif"], "moment.gif", { type: "image/gif" });
    expect(await compressActivityPhoto(gif)).toBe(gif);
    const largeGif = new File(["gif"], "large.gif", { type: "image/gif" });
    Object.defineProperty(largeGif, "size", { value: 4 * 1024 * 1024 });
    await expect(compressActivityPhoto(largeGif)).rejects.toThrow(
      "Animated GIFs",
    );
    expect(mocks.compress).not.toHaveBeenCalled();
  });

  it("rejects unsupported, empty and oversized source files", async () => {
    await expect(
      compressActivityPhoto(
        new File(["svg"], "drawing.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toThrow("Choose JPG");
    await expect(
      compressActivityPhoto(new File([], "empty.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow("non-empty");
    const oversized = new File(["jpg"], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(oversized, "size", { value: 26 * 1024 * 1024 });
    await expect(compressActivityPhoto(oversized)).rejects.toThrow("25 MB");
  });
});

describe("Sequential activity photo uploads", () => {
  it("sends one compressed photo per request with the caption and activity binding", async () => {
    const upload = vi.fn().mockResolvedValue({ success: true });
    const result = await uploadActivityPhotos({
      files: [
        new File(["one"], "one.jpg", { type: "image/jpeg" }),
        new File(["two"], "two.jpg", { type: "image/jpeg" }),
      ],
      activityId: "activity-1",
      caption: "Community moments",
      upload,
      onProgress: vi.fn(),
    });
    expect(result.uploaded).toBe(2);
    expect(result.failures).toEqual([]);
    expect(upload).toHaveBeenCalledTimes(2);
    for (const [data] of upload.mock.calls) {
      expect(data.getAll("files")).toHaveLength(1);
      expect(data.get("activityId")).toBe("activity-1");
      expect(data.get("caption")).toBe("Community moments");
    }
    expect(mocks.compress.mock.invocationCallOrder[1]).toBeGreaterThan(
      upload.mock.invocationCallOrder[0],
    );
  });

  it("retains only failed files for retry and catches thrown action errors", async () => {
    const failed = new File(["one"], "one.jpg", { type: "image/jpeg" });
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ success: true });
    const result = await uploadActivityPhotos({
      files: [failed, new File(["two"], "two.jpg", { type: "image/jpeg" })],
      activityId: "activity-1",
      caption: "",
      upload,
      onProgress: vi.fn(),
    });
    expect(result.uploaded).toBe(1);
    expect(result.failures).toEqual([
      { file: failed, error: "Network unavailable" },
    ]);
  });

  it("rejects oversized batches before compression or upload", async () => {
    const upload = vi.fn();
    await expect(
      uploadActivityPhotos({
        files: Array.from(
          { length: 11 },
          () => new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        ),
        activityId: "activity-1",
        caption: "",
        upload,
        onProgress: vi.fn(),
      }),
    ).rejects.toThrow("1 and 10");
    expect(upload).not.toHaveBeenCalled();
    expect(mocks.compress).not.toHaveBeenCalled();
  });
});

describe("On-demand moments gallery", () => {
  const albums = [
    {
      id: "activity-1",
      title: "Community literacy",
      coverUrl: "/cover.webp",
      mediaCount: 25,
    },
  ];

  it("does not load an album until opened, then paginates on demand", async () => {
    mocks.moments.mockResolvedValueOnce({
      success: true,
      media: [
        {
          id: "photo-1",
          url: "/photo.webp",
          caption: "Club volunteers",
          isFeatured: false,
        },
      ],
      hasMore: true,
    });
    mocks.moments.mockResolvedValueOnce({
      success: true,
      media: [
        {
          id: "photo-2",
          url: "/photo-two.webp",
          caption: "Community partners",
          isFeatured: false,
        },
      ],
      hasMore: false,
    });
    render(createElement(ActivityMoments, { activities: albums }));
    expect(mocks.moments).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open moments for Community literacy",
      }),
    );
    expect(await screen.findByAltText("Club volunteers")).toHaveAttribute(
      "loading",
      "lazy",
    );
    expect(mocks.moments).toHaveBeenCalledWith("activity-1", 0);
    expect(
      screen.getByRole("link", { name: "Open project media" }),
    ).toHaveAttribute("href", "/project-center/activity-1?tab=media");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Load more photos" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more photos" }));
    await waitFor(() =>
      expect(mocks.moments).toHaveBeenCalledWith("activity-1", 1),
    );
    expect(
      await screen.findByAltText("Community partners"),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Club volunteers")).toBeInTheDocument();
  });

  it("handles action failures inline without throwing a route error", async () => {
    mocks.moments.mockRejectedValue(new Error("Network unavailable"));
    render(createElement(ActivityMoments, { activities: albums }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open moments for Community literacy",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Moments could not be loaded",
    );
  });

  it("has a useful empty state", () => {
    render(createElement(ActivityMoments, { activities: [] }));
    expect(
      screen.getByText("No moments match these filters."),
    ).toBeInTheDocument();
    expect(mocks.moments).not.toHaveBeenCalled();
  });
});
