/** Books. One personal sentence each, never a summary of the book, and never
 *  a line that stages the reader instead: no reading rituals, no ranking of
 *  oneself against the text. The note says something, or it goes.
 *  `year` is the year read, not the year published. Where the year is not
 *  confirmed yet it is left empty and simply does not render. */

export type Book = {
  title: string;
  author: string;
  year: string;
  note: string;
};

export const books: Book[] = [
  {
    title: "Meditations",
    author: "Marcus Aurelius",
    year: "",
    note: "I read it before I had anything to apply it to, which is probably why it stuck.",
  },
  {
    title: "The Man Who Solved the Market",
    author: "Gregory Zuckerman",
    year: "",
    note: "Most of Renaissance's edge looks like infrastructure discipline.",
  },
  {
    title: "Reminiscences of a Stock Operator",
    author: "Edwin Lefèvre",
    year: "",
    note: "A hundred years old and still the best description I've read of what a market does to the person watching it.",
  },
];
