import { describe, expect, it } from "vitest";
import { AD_EMAIL, AD_SUBJECT, advertiseMailto, renderSponsorSection } from "../src/sponsors";

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"));
}

describe("renderSponsorSection", () => {
  it("shows only the dashed inquiry card when no sponsor is configured", () => {
    const html = renderSponsorSection([], "en");
    expect(html).toContain("Advertise here");
    expect(html).toContain("Reach developers who use Grok Bot, Grok Build, and Cursor.");
    expect(html).not.toContain("sponsor-card");
    const mailto = hrefs(html).find((href) => href.startsWith("mailto:"));
    expect(mailto).toBeDefined();
    const url = new URL(mailto ?? "");
    expect(url.pathname).toBe(AD_EMAIL);
    expect(url.searchParams.get("subject")).toBe(AD_SUBJECT);
    expect(url.searchParams.get("body")).toContain("I would like to advertise on Grok Resets.");
  });

  it("uses Korean copy on the empty card", () => {
    const html = renderSponsorSection([], "ko");
    expect(html).toContain("여기에 광고하기");
    expect(html).toContain("Grok Bot, Grok Build, Cursor를 쓰는 개발자에게 닿습니다.");
    const mailto = hrefs(html).find((href) => href.startsWith("mailto:"));
    const url = new URL(mailto ?? "");
    expect(url.searchParams.get("subject")).toBe("[Grok Resets] 광고 문의 / Advertising inquiry");
    expect(url.searchParams.get("body")).toContain("광고를 문의합니다.");
  });

  it("renders a configured sponsor instead of the inquiry card", () => {
    const html = renderSponsorSection(
      [
        {
          name: "Northwind",
          url: "https://northwind.example/tools",
          tagline: "Quiet tools.",
          tagline_ko: "조용한 도구.",
        },
        { name: "Skipped", url: "javascript:alert(1)", tagline: "no" },
      ],
      "ko",
    );
    expect(html).toContain("Northwind");
    expect(html).toContain("https://northwind.example/tools");
    expect(html).toContain("조용한 도구.");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("여기에 광고하기");
    expect(html).not.toContain("Skipped");
    expect(html).not.toContain("javascript:");
  });

  it("escapes sponsor text and falls back to the English tagline", () => {
    const html = renderSponsorSection(
      [{ name: "<b>Acme</b>", url: "https://acme.example", tagline: "Tools & logs" }],
      "ko",
    );
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("Tools &amp; logs");
  });

  it("drops an empty list entry and shows the inquiry card again", () => {
    const html = renderSponsorSection([{ name: "", url: "https://acme.example", tagline: "Hi" }], "en");
    expect(html).toContain("Advertise here");
    expect(html).not.toContain("acme.example");
  });
});

describe("advertiseMailto", () => {
  it("addresses the inquiry mailbox", () => {
    expect(advertiseMailto("en").startsWith(`mailto:${AD_EMAIL}?`)).toBe(true);
    expect(AD_SUBJECT).toBe("[Grok Resets] 광고 문의 / Advertising inquiry");
  });
});
