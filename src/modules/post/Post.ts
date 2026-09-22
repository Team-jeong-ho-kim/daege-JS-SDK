import type { mager } from "../global/Mager.js";

export type post = {
  id: string;
  title: string;
  content: string;
  mager: mager[];
};
