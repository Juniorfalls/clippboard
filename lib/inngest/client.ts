import { Inngest } from "inngest";

const eventKey = process.env.INNGEST_EVENT_KEY?.trim();

export const inngest = new Inngest({
  id: "clippboard",
  eventKey,
});
