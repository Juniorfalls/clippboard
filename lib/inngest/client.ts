import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "clippboard",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
