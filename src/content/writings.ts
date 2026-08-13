/** Writings.
 *
 *  Body format is a small block model rather than MDX, so that a web editor can
 *  read and write it later without a parser: every block is plain JSON.
 *
 *  Inline syntax inside `text`, handled by src/lib/inline.tsx:
 *    [label](https://url)   link
 *    *emphasis*             italic
 *    [^1]                   sidenote marker, matched to a { kind: "note" } block
 *
 *  `draft: true` keeps an entry out of the site entirely: listings, sitemap and
 *  feed. Titles below that are drafts come from the copy deck as suggestions;
 *  nothing is published before Oscar has written it. */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string; source: string }
  | { kind: "note"; n: number; text: string };

export type Writing = {
  slug: string;
  title: string;
  /** The one sentence that gives the angle. */
  subtitle: string;
  /** ISO date, used for sorting, <time> and the feed. */
  date: string;
  readingTime: string;
  draft?: boolean;
  blocks?: Block[];
};

export const writings: Writing[] = [
  {
    slug: "compliance-is-a-software-problem",
    title: "Compliance Is a Software Problem",
    subtitle:
      "Most of what a regulator asks for is a query. Firms still answer with headcount.",
    date: "2026-08-12",
    readingTime: "9 min",
    blocks: [
      {
        kind: "p",
        text: "Every firm I have worked in kept its obligations in three places at once: a PDF from the lawyers, a spreadsheet maintained by whoever was least senior, and the head of the person who had been there longest. The three disagreed. Nobody noticed until the auditor arrived, and by then the disagreement had become a finding.",
      },
      {
        kind: "p",
        text: "This is usually described as a documents problem, which is why a decade of compliance software has been document storage with a search bar bolted on. It is not a documents problem. The documents are fine. What is missing is the thing that knows, on any given Tuesday, which obligations are live, which are due, which are waiting on somebody else, and what evidence would satisfy each of them.",
      },
      { kind: "h2", text: "What the work actually is" },
      {
        kind: "p",
        text: "Take a mid-sized fund. Its duties come from four places: its own constitutional documents, the regulator, the depositary agreement, and whatever side letters investors negotiated in the weeks when they had leverage. Call it a few hundred distinct obligations, each with a trigger, a deadline, an owner, and an evidence requirement.[^1]",
      },
      {
        kind: "note",
        n: 1,
        text: "A few hundred is not a rhetorical figure. Once side letters are counted separately the register is routinely four figures, and a third of it exists in exactly one fund on earth.",
      },
      {
        kind: "p",
        text: "Almost none of this is intellectually hard. It is hard because it is ambient. The trigger for one duty is the completion of another. The owner changes when somebody leaves. The deadline moves when a regulator publishes an interpretation in the footnote of a newsletter. People are poor at ambient work and excellent at explaining, afterwards, why the ambient work did not get done.",
      },
      {
        kind: "quote",
        text: "The depositary shall ensure that the AIF's cash flows are properly monitored, and shall ensure that all payments made by, or on behalf of, investors upon the subscription of units have been received.",
        source: "AIFMD, Article 21(7)",
      },
      {
        kind: "p",
        text: "That is one sentence. Turned into checkable duties it becomes eleven, with three owners and two kinds of evidence, one of which only exists as a file a bank emails on the fourth working day of the month. Multiply it out and you have the job.",
      },
      { kind: "h2", text: "Why the answer is headcount" },
      {
        kind: "p",
        text: "Ask a fund how it satisfies that paragraph and the answer is a name. Ask how it knows the name did it, and the answer is a longer name. The work is real, so the firm hires for it, and because the work is invisible until it fails, the hire is justified by the failure that did not happen. This is a stable arrangement. It is also the reason the cost of running a small fund has not fallen in twenty years while the cost of running a small software company has fallen by an order of magnitude.",
      },
      {
        kind: "p",
        text: "The objection to automating it is usually that the rules require judgment. Some of them do. Most of what a regulator asks for is a query: which obligations were open in the period, who closed them, on what date, against what evidence. A firm that can answer that in an afternoon has not replaced anyone's judgment. It has stopped spending judgment on retrieval.",
      },
      { kind: "h2", text: "Where the software stops" },
      {
        kind: "p",
        text: "The interesting boundary is not what a model can read. It is what a model is allowed to conclude without a human name attached to the conclusion.[^2] Extraction and monitoring can be automated end to end: reading the instruments, proposing the register, watching for triggers, drafting the pack. Attestation cannot. The regulation names natural persons, and a signature from a model is not a signature.",
      },
      {
        kind: "note",
        n: 2,
        text: "Which is a legal question before it is a technical one, and the two are answered by different people who rarely read each other's documents.",
      },
      {
        kind: "p",
        text: "Three failure modes are worth knowing before trusting any of this. *Confident extraction of a duty that does not exist*, where the system reads a recital as an obligation; cheap to catch, as long as every extracted duty points back to the sentence it came from and the reviewer is shown the sentence rather than the summary. *Silent drift*, where the register is right in March and wrong in September because a side letter was amended by email; this is the one that actually hurts, and the only defence is structural, which is that no obligation outlives the version of the document it came from. And *automating the wrong thing*, which is the temptation to generate the report, because reports are visible and demos are short. The report was never the work. The work was knowing it was due, and to whom, and with what attached.",
      },
      {
        kind: "p",
        text: "None of this is a prediction about artificial intelligence. It is an observation about where a firm's money goes, and a claim that the largest line item in the middle office is retrieval that a database has been able to do since 1985. What changed recently is only the reading, and the reading was the part that made the database too expensive to fill.",
      },
    ],
  },

  /* Suggested in the copy deck, not written yet. Flip `draft` when the text
     exists; nothing else needs to change. */
  {
    slug: "build-it-then-sell-it",
    title: "Build It, Then Sell It",
    subtitle: "The case for putting the person who wrote the code in the client meeting.",
    date: "2026-07-01",
    readingTime: "",
    draft: true,
  },
  {
    slug: "tokenized-private-equity-two-years-on",
    title: "Tokenized Private Equity, Two Years On",
    subtitle: "What broke when we put private-equity shares on-chain.",
    date: "2026-06-01",
    readingTime: "",
    draft: true,
  },
  {
    slug: "where-agents-break",
    title: "Where Agents Break",
    subtitle:
      "LLM agents inside a regulated workflow, and the failure modes worth knowing about before you trust one.",
    date: "2026-05-01",
    readingTime: "",
    draft: true,
  },
  {
    slug: "what-an-ai-native-fund-actually-looks-like",
    title: "What an AI-Native Fund Actually Looks Like",
    subtitle: "Which parts of a firm are code by now, and which are still meetings.",
    date: "2026-03-01",
    readingTime: "",
    draft: true,
  },
];

export const published = writings
  .filter((w) => !w.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

export function getWriting(slug: string) {
  return published.find((w) => w.slug === slug);
}

export function formatMonth(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDay(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
