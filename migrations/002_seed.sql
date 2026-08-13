-- The content that lived in src/content/writings.ts and src/content/books.ts,
-- moved into the database verbatim. Drafts come across as drafts.

INSERT INTO writings (slug, title, subtitle, body, reading_time, published, published_at) VALUES (
  'compliance-is-a-software-problem',
  'Compliance Is a Software Problem',
  'Most of what a regulator asks for is a query. Firms still answer with headcount.',
  'Every firm I have worked in kept its obligations in three places at once: a PDF from the lawyers, a spreadsheet maintained by whoever was least senior, and the head of the person who had been there longest. The three disagreed. Nobody noticed until the auditor arrived, and by then the disagreement had become a finding.

This is usually described as a documents problem, which is why a decade of compliance software has been document storage with a search bar bolted on. It is not a documents problem. The documents are fine. What is missing is the thing that knows, on any given Tuesday, which obligations are live, which are due, which are waiting on somebody else, and what evidence would satisfy each of them.

## What the work actually is

Take a mid-sized fund. Its duties come from four places: its own constitutional documents, the regulator, the depositary agreement, and whatever side letters investors negotiated in the weeks when they had leverage. Call it a few hundred distinct obligations, each with a trigger, a deadline, an owner, and an evidence requirement.[^1]

[^1]: A few hundred is not a rhetorical figure. Once side letters are counted separately the register is routinely four figures, and a third of it exists in exactly one fund on earth.

Almost none of this is intellectually hard. It is hard because it is ambient. The trigger for one duty is the completion of another. The owner changes when somebody leaves. The deadline moves when a regulator publishes an interpretation in the footnote of a newsletter. People are poor at ambient work and excellent at explaining, afterwards, why the ambient work did not get done.

> The depositary shall ensure that the AIF''s cash flows are properly monitored, and shall ensure that all payments made by, or on behalf of, investors upon the subscription of units have been received.
> — AIFMD, Article 21(7)

That is one sentence. Turned into checkable duties it becomes eleven, with three owners and two kinds of evidence, one of which only exists as a file a bank emails on the fourth working day of the month. Multiply it out and you have the job.

## Why the answer is headcount

Ask a fund how it satisfies that paragraph and the answer is a name. Ask how it knows the name did it, and the answer is a longer name. The work is real, so the firm hires for it, and because the work is invisible until it fails, the hire is justified by the failure that did not happen. This is a stable arrangement. It is also the reason the cost of running a small fund has not fallen in twenty years while the cost of running a small software company has fallen by an order of magnitude.

The objection to automating it is usually that the rules require judgment. Some of them do. Most of what a regulator asks for is a query: which obligations were open in the period, who closed them, on what date, against what evidence. A firm that can answer that in an afternoon has not replaced anyone''s judgment. It has stopped spending judgment on retrieval.

## Where the software stops

The interesting boundary is not what a model can read. It is what a model is allowed to conclude without a human name attached to the conclusion.[^2] Extraction and monitoring can be automated end to end: reading the instruments, proposing the register, watching for triggers, drafting the pack. Attestation cannot. The regulation names natural persons, and a signature from a model is not a signature.

[^2]: Which is a legal question before it is a technical one, and the two are answered by different people who rarely read each other''s documents.

Three failure modes are worth knowing before trusting any of this. *Confident extraction of a duty that does not exist*, where the system reads a recital as an obligation; cheap to catch, as long as every extracted duty points back to the sentence it came from and the reviewer is shown the sentence rather than the summary. *Silent drift*, where the register is right in March and wrong in September because a side letter was amended by email; this is the one that actually hurts, and the only defence is structural, which is that no obligation outlives the version of the document it came from. And *automating the wrong thing*, which is the temptation to generate the report, because reports are visible and demos are short. The report was never the work. The work was knowing it was due, and to whom, and with what attached.

None of this is a prediction about artificial intelligence. It is an observation about where a firm''s money goes, and a claim that the largest line item in the middle office is retrieval that a database has been able to do since 1985. What changed recently is only the reading, and the reading was the part that made the database too expensive to fill.',
  '9 min',
  true,
  '2026-08-12T00:00:00Z'::timestamptz
);

INSERT INTO writings (slug, title, subtitle, body, reading_time, published, published_at) VALUES (
  'build-it-then-sell-it',
  'Build It, Then Sell It',
  'The case for putting the person who wrote the code in the client meeting.',
  '',
  '',
  false,
  '2026-07-01T00:00:00Z'::timestamptz
);

INSERT INTO writings (slug, title, subtitle, body, reading_time, published, published_at) VALUES (
  'tokenized-private-equity-two-years-on',
  'Tokenized Private Equity, Two Years On',
  'What broke when we put private-equity shares on-chain.',
  '',
  '',
  false,
  '2026-06-01T00:00:00Z'::timestamptz
);

INSERT INTO writings (slug, title, subtitle, body, reading_time, published, published_at) VALUES (
  'where-agents-break',
  'Where Agents Break',
  'LLM agents inside a regulated workflow, and the failure modes worth knowing about before you trust one.',
  '',
  '',
  false,
  '2026-05-01T00:00:00Z'::timestamptz
);

INSERT INTO writings (slug, title, subtitle, body, reading_time, published, published_at) VALUES (
  'what-an-ai-native-fund-actually-looks-like',
  'What an AI-Native Fund Actually Looks Like',
  'Which parts of a firm are code by now, and which are still meetings.',
  '',
  '',
  false,
  '2026-03-01T00:00:00Z'::timestamptz
);

INSERT INTO books (title, author, year_read, note, sort_order) VALUES (
  'Meditations',
  'Marcus Aurelius',
  NULL,
  'I read it before I had anything to apply it to, which is probably why it stuck.',
  1
);

INSERT INTO books (title, author, year_read, note, sort_order) VALUES (
  'The Man Who Solved the Market',
  'Gregory Zuckerman',
  NULL,
  'Most of Renaissance''s edge looks like infrastructure discipline.',
  2
);

INSERT INTO books (title, author, year_read, note, sort_order) VALUES (
  'Reminiscences of a Stock Operator',
  'Edwin Lefèvre',
  NULL,
  'A hundred years old and still the best description I''ve read of what a market does to the person watching it.',
  3
);
