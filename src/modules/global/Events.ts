import type { comment } from "../post/Comment.js";
import type { post } from "../post/Post.js";
import type { template } from "../post/Template.js";
import type { Client, ReadyClient } from "./Client.js";

export enum Events {
  Ready = "ready",
  PostCreated = "postCreated",
  PostUpdated = "postUpdated",
  PostDeleted = "postDeleted",
  CommentCreated = "commentCreated",
  CommentUpdated = "commentUpdated",
  CommentDeleted = "commentDeleted",
  LikeAdded = "likeAdded",
  LikeRemoved = "likeRemoved",
  TemplateCreated = "templateCreated",
  TemplateUpdated = "templateUpdated",
  TemplateDeleted = "templateDeleted",
}

export type EventCallback = (data: any) => void;

export interface EventListeners {
  [event: string]: EventCallback[];
}

export interface EventMap {
  [Events.Ready]: [client: ReadyClient];
  [Events.PostCreated]: [post: post];
  [Events.PostUpdated]: [post: post];
  [Events.PostDeleted]: [postId: string];
  [Events.CommentCreated]: [comment: comment];
  [Events.CommentUpdated]: [comment: comment];
  [Events.CommentDeleted]: [commentId: string];
  [Events.LikeAdded]: [post: post, userId: string];
  [Events.LikeRemoved]: [post: post, userId: string];
  [Events.TemplateCreated]: [template: template];
  [Events.TemplateUpdated]: [template: template];
  [Events.TemplateDeleted]: [templateId: string];
}

export type StreamEvent = {
  [K in keyof EventMap]: {
    event: K;
    args: EventMap[K];
  };
}[keyof EventMap];
