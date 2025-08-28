import JSONL from "jsonl-parse-stringify";

import { inngest } from "@/inngest/client";

import { StreamTranscriptItem } from "@/modules/meetings/types";
import { db } from "@/db";
import { agents, user } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { name } from "@stream-io/video-react-sdk";

export const helloWorld = inngest.createFunction(
  { id: "meetngs/processing" },
  { event: "meetings/processing" },
  async ({ event, step }) => {
    const response = await step.run("fetch-transcript", async () => {
      return fetch(event.data.transcriptUrl).then((res) => res.text());
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) =>
          users.map((user) => ({
            ...user,
          }))
      );
      const agentSpeakers = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) =>
          agents.map((agent) => ({
            ...agent,
          }))
      );
        
        const speakers = [...userSpeakers, ...agentSpeakers];

        return transcript.map((item) => {
            const speaker = speakers.find(
                (speaker) => speaker.id === item.speaker_id
            );

            if (!speaker) {
                return {
                    ...item,
                    user: {
                        name: "Unknown",
                    },
                };
            }
            return {
                ...item,
                user: {
                    name: speaker.name,
                },
            };
        });
    });
  }
);
