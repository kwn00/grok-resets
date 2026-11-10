import { unreachable } from "./unreachable";
import type { Lang, ResetType } from "./types";

export interface Copy {
  langGroup: string;
  ledeBefore: string;
  ledeAfter: string;
  subtitle: string;
  latestHeading: string;
  empty: string;
  viewAnnouncement: string;
  newTab: string;
  utcLabel: string;
  localLabel: string;
  summaryHeading: string;
  totalLabel: string;
  averageLabel: string;
  sinceLabel: string;
  longestLabel: string;
  intervalHint: string;
  sponsorHeading: string;
  advertiseTitle: string;
  advertiseBody: string;
  advertiseMailBody: string;
  thanksLabel: string;
  thanksUnavailable: string;
  heatHeading: string;
  heatNote: string;
  heatLess: string;
  heatMore: string;
  heatSummary: (count: number, latestDate: string | null) => string;
  dow: readonly [string, string, string];
  resetCount: (count: number) => string;
  announcementsHeading: string;
  announcementsNote: string;
  apiHeading: string;
  apiNote: string;
  apiResets: string;
  apiStatus: string;
  footerBefore: string;
  footerAfter: string;
}

const copy: Record<Lang, Copy> = {
  en: {
    langGroup: "Language",
    ledeBefore:
      "One announcement refills the shared allowance for all three at the same time. Times come from public posts by ",
    ledeAfter: " on X. This page never reads an account.",
    subtitle: "Grok Bot · Grok Build · Cursor combined plan resets",
    latestHeading: "Latest reset",
    empty: "No reset announcements have been recorded yet.",
    viewAnnouncement: "View announcement",
    newTab: "opens in a new tab",
    utcLabel: "UTC",
    localLabel: "Local",
    summaryHeading: "Summary",
    totalLabel: "Total resets",
    averageLabel: "Average interval",
    sinceLabel: "Days since last reset",
    longestLabel: "Longest wait",
    intervalHint: "Average interval and the longest wait appear after a second announcement.",
    sponsorHeading: "Sponsor",
    advertiseTitle: "Advertise here",
    advertiseBody: "Reach developers who use Grok Bot, Grok Build, and Cursor.",
    advertiseMailBody: "Hello,\n\nI would like to advertise on Grok Resets.\n\nSite:\nName:\n",
    thanksLabel: "Thanks @bot",
    thanksUnavailable: "Count unavailable",
    heatHeading: "26-week record",
    heatNote:
      "Each square is one UTC day, with the newest week on the right. Brighter squares are days with a reset announcement.",
    heatLess: "None",
    heatMore: "More",
    heatSummary(count, latestDate) {
      if (count === 0 || latestDate === null) {
        return "Heatmap of the last 26 weeks in UTC. No resets in this window.";
      }
      const noun = count === 1 ? "announcement" : "announcements";
      return `Heatmap of the last 26 weeks in UTC. ${count} reset ${noun} in this window, latest on ${latestDate}.`;
    },
    dow: ["Mon", "Wed", "Fri"],
    resetCount(count) {
      return count === 1 ? "1 reset" : `${count} resets`;
    },
    announcementsHeading: "Announcements",
    announcementsNote: "Newest first. The quoted text is the original post.",
    apiHeading: "Machine-readable",
    apiNote: "These JSON files are written when the site is built. The thanks count is the only live number.",
    apiResets: "Reset list",
    apiStatus: "Status summary",
    footerBefore:
      "Independent tracker. Not affiliated with Grok Bot, SpaceXAI, X, or Cursor. Data is taken from public posts by ",
    footerAfter: ".",
  },
  ko: {
    langGroup: "언어",
    ledeBefore:
      "공지 한 번으로 세 제품의 통합 사용량이 함께 다시 채워집니다. 시각은 X의 ",
    ledeAfter: " 공개 게시물 기준이며, 이 페이지는 계정을 조회하지 않습니다.",
    subtitle: "Grok Bot · Grok Build · Cursor 통합 플랜 초기화",
    latestHeading: "최근 초기화",
    empty: "아직 기록된 초기화 공지가 없습니다.",
    viewAnnouncement: "공지 보기",
    newTab: "새 탭에서 열림",
    utcLabel: "UTC",
    localLabel: "현지",
    summaryHeading: "요약",
    totalLabel: "누적 초기화",
    averageLabel: "평균 간격",
    sinceLabel: "마지막 초기화 후",
    longestLabel: "최장 공백",
    intervalHint: "평균 간격과 최장 공백은 공지가 두 건 이상일 때 계산됩니다.",
    sponsorHeading: "스폰서",
    advertiseTitle: "여기에 광고하기",
    advertiseBody: "Grok Bot, Grok Build, Cursor를 쓰는 개발자에게 닿습니다.",
    advertiseMailBody: "안녕하세요.\n\nGrok Resets에 광고를 문의합니다.\n\n사이트:\n이름:\n",
    thanksLabel: "고마워요",
    thanksUnavailable: "횟수를 표시할 수 없습니다",
    heatHeading: "26주 기록",
    heatNote:
      "한 칸은 UTC 기준 하루이고, 오른쪽 끝이 최근 주입니다. 밝은 칸은 그날 초기화 공지가 있었음을 뜻합니다.",
    heatLess: "없음",
    heatMore: "많음",
    heatSummary(count, latestDate) {
      if (count === 0 || latestDate === null) {
        return "UTC 기준 최근 26주 히트맵. 이 구간에 초기화가 없습니다.";
      }
      return `UTC 기준 최근 26주 히트맵. 이 구간에 초기화 ${count}건, 마지막 날짜는 ${latestDate}입니다.`;
    },
    dow: ["월", "수", "금"],
    resetCount(count) {
      return `${count}건`;
    },
    announcementsHeading: "공지",
    announcementsNote: "최신순입니다. 인용문은 게시 원문입니다.",
    apiHeading: "기계가 읽는 데이터",
    apiNote: "이 JSON 파일은 사이트를 빌드할 때 만들어집니다. 실시간으로 바뀌는 값은 고마움 횟수뿐입니다.",
    apiResets: "초기화 목록",
    apiStatus: "상태 요약",
    footerBefore:
      "독립적인 추적 사이트입니다. Grok Bot, SpaceXAI, X, Cursor와 무관합니다. 데이터는 ",
    footerAfter: "의 공개 게시물에서 가져옵니다.",
  },
};

export function t(lang: Lang): Copy {
  switch (lang) {
    case "en":
      return copy.en;
    case "ko":
      return copy.ko;
    default:
      return unreachable(lang);
  }
}

export function typeLabel(type: ResetType, lang: Lang): string {
  switch (type) {
    case "weekly":
      switch (lang) {
        case "en":
          return "Weekly reset";
        case "ko":
          return "주간 한도 초기화";
        default:
          return unreachable(lang);
      }
    case "general":
      switch (lang) {
        case "en":
          return "Usage reset";
        case "ko":
          return "사용량 초기화";
        default:
          return unreachable(lang);
      }
    default:
      return unreachable(type);
  }
}
