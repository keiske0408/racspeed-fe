import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navMocks = vi.hoisted(() => ({
  pathname: "/dashboard",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navMocks.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

import { Sidebar } from "@/components/layout/sidebar";

afterEach(cleanup);

describe("Sidebar active link detection", () => {
  it("highlights only Notification Settings on /settings/notifications and not Club Settings", () => {
    navMocks.pathname = "/settings/notifications";
    render(createElement(Sidebar, { userFullName: "Test Officer" }));

    const notifLink = screen.getByRole("link", {
      name: /Notification Settings/i,
    });
    const clubSettingsLink = screen.getByRole("link", {
      name: /Club Settings/i,
    });

    expect(notifLink.className).toContain("font-semibold");
    expect(notifLink.className).toContain("shadow-xs");
    expect(clubSettingsLink.className).not.toContain("shadow-xs");
    expect(clubSettingsLink.className).toContain("font-medium");
  });

  it("highlights only Club Settings on /settings", () => {
    navMocks.pathname = "/settings";
    render(createElement(Sidebar, { userFullName: "Test Officer" }));

    const notifLink = screen.getByRole("link", {
      name: /Notification Settings/i,
    });
    const clubSettingsLink = screen.getByRole("link", {
      name: /Club Settings/i,
    });

    expect(clubSettingsLink.className).toContain("font-semibold");
    expect(clubSettingsLink.className).toContain("shadow-xs");
    expect(notifLink.className).not.toContain("shadow-xs");
  });
});

