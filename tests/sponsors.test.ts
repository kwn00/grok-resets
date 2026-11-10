import { describe, expect, it } from "vitest";
import {
  AD_EMAIL,
  AD_SUBJECT,
  advertiseMailto,
  renderSponsorRails,
  renderSponsorSection,
} from "../src/sponsors";

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"));
}

describe("renderSponsorSection", () => {
  it("explains the empty center slot and puts the inquiry card on the right rail", () => {
    const html = renderSponsorSection([], "en");
    expect(html).toContain("Sponsors show up here.");
    expect(html).toContain("sponsor-follow");
    expect(html).toContain("Advertise here");
    expect(html).toContain("Reach developers who use Grok Bot, Grok Build, and Cursor.");
    expect(html).not.toContain("sponsor-card");
    const mailto = hrefs(html).find((href) => href.startsWith("mailto:"));
    const url = new URL(mailto ?? "");
    expect(url.pathname).toBe(AD_EMAIL);
    expect(url.searchParams.get("subject")).toBe(AD_SUBJECT);
    expect(url.searchParams.get("body")).toContain("I would like to advertise on Grok Resets.");
    const rails = renderSponsorRails([], "en");
    expect(rails.left).toBe("");
    expect(rails.right).toContain("Advertise here");
    expect(rails.right).not.toContain("sponsor-card");
  });

  it("uses Korean copy on the empty card", () => {
    const html = renderSponsorSection([], "ko");
    expect(html).toContain("스폰서가 있으면 이곳에 나옵니다.");
    expect(html).toContain("여기에 광고하기");
    expect(html).toContain("Grok Bot, Grok Build, Cursor를 쓰는 개발자에게 닿습니다.");
    const mailto = hrefs(html).find((href) => href.startsWith("mailto:"));
    const url = new URL(mailto ?? "");
    expect(url.searchParams.get("subject")).toBe("[Grok Resets] 광고 문의 / Advertising inquiry");
    expect(url.searchParams.get("body")).toContain("광고를 문의합니다.");
  });

  it("features one sponsor in the column and lists every sponsor in the rails", () => {
    const rows = [
      { name: "Northwind", url: "https://northwind.example/tools", tagline: "Quiet tools.", tagline_ko: "조용한 도구." },
      { name: "Harbor", url: "https://harbor.example", tagline: "A second card." },
      { name: "Lumen", url: "https://lumen.example", tagline: "A third card." },
      { name: "Skipped", url: "javascript:alert(1)", tagline: "no" },
    ];
    const featured = renderSponsorSection(rows, "ko", 1);
    expect(featured).toContain("Harbor");
    expect(featured).not.toContain("Northwind");
    expect(featured).not.toContain("Lumen");
    expect(featured).toContain("sponsor-follow");
    expect(featured).toContain("여기에 광고하기");

    const first = renderSponsorSection(rows, "ko", 0);
    expect(first).toContain("조용한 도구.");
    expect(first).toContain("https://northwind.example/tools");
    expect(first).toContain('target="_blank"');
    expect(first).not.toContain("Skipped");
    expect(first).not.toContain("javascript:");

    const rails = renderSponsorRails(rows, "ko");
    expect(rails.right).toContain("Northwind");
    expect(rails.right).toContain("Lumen");
    expect(rails.right).not.toContain("Harbor");
    expect(rails.right).not.toContain("여기에 광고하기");
    expect(rails.left).toContain("Harbor");
    expect(rails.left).toContain("여기에 광고하기");
    expect(rails.left).not.toContain("javascript:");

    const one = renderSponsorRails([rows[0]], "ko");
    expect(one.right).toContain("Northwind");
    expect(one.right).not.toContain("여기에 광고하기");
    expect(one.left).toContain("여기에 광고하기");

    const two = renderSponsorRails([rows[0], rows[1]], "ko");
    expect(two.right).toContain("Northwind");
    expect(two.right).toContain("여기에 광고하기");
    expect(two.left).toContain("Harbor");
    expect(two.left).not.toContain("여기에 광고하기");
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
