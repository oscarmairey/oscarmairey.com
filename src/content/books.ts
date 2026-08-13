/** Books. One personal sentence each, never a summary of the book.
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
    year: "reread most years",
    note: "I read it before I had anything to apply it to, which is probably why it stuck. It's the only book here I argue with.",
  },
  {
    title: "The Man Who Solved the Market",
    author: "Gregory Zuckerman",
    year: "",
    note: "I read it as an engineering story. Most of Renaissance's edge looks like infrastructure discipline.",
  },
  {
    title: "Reminiscences of a Stock Operator",
    author: "Edwin Lefèvre",
    year: "",
    note: "A hundred years old and still the best description I've read of what a market does to the person watching it.",
  },
];
