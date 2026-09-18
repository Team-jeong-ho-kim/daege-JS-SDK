import { mager } from "../global/Mager.ts";

export type post = {
  id: string;
  title: string;
  content: string;
  mager: mager[];
};
