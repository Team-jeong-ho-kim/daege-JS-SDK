import { Events } from "../../global/Events.js";
import type { post } from "../../post/Post.js";
import { Client } from "../../global/Client.js";

export function PostCreated(post: post, client: Client): void {
  //@ts-ignore
  client.z_handleEvent(Events.PostCreated, post);
}
