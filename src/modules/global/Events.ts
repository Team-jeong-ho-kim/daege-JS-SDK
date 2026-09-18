import { comment } from "../post/Comment.ts";
import { post } from "../post/Post.ts";
import { template } from "../post/Template.ts";

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
  [Events.Ready]: [];
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
