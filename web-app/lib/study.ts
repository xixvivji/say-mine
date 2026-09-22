import { z } from "zod";
import config from "./survey-config.json";
export const groups = config.groups;
export const types = config.types;
export const levels = config.levels;
export const targets = config.targets;
export const works = config.works;
export const students = config.students;
export const homes = config.homes;
export const topicOptions = Object.values(groups).flat();
const choice = (options: string[]) =>
  z.string().refine((v) => options.includes(v));
export const surveySchema = z
  .object({
    work: choice(works),
    student: choice(students),
    home: choice(homes),
    level: choice(levels),
    target: choice(targets),
    topics: z
      .array(choice(topicOptions))
      .min(1)
      .max(12)
      .refine((a) => new Set(a).size === a.length),
    topic: z.string(),
    type: choice(types),
    experience: z.string().trim().min(5).max(1500),
  })
  .strict()
  .refine(
    (s) => s.topics.includes(s.topic),
    "선택한 주제만 연습할 수 있습니다.",
  );
export const noteSchema = z.object({
  question: z.string().min(5).max(500),
  outline: z.array(z.string()).min(3).max(4),
  answer: z.string().min(10).max(2000),
  phrases: z
    .array(z.object({ english: z.string(), korean: z.string() }))
    .min(2)
    .max(3),
  keywords: z.array(z.string()).min(3).max(5),
  variations: z.array(z.string()).length(2),
  missing_details: z.array(z.string()).max(3),
  tip: z.string().min(5).max(400),
});
export type Survey = z.infer<typeof surveySchema>;
export type Note = z.infer<typeof noteSchema>;
export const statusSchema = z.object({ ready: z.boolean(), label: z.string() });
export const errorSchema = z.object({ error: z.string() });
export const generationSchema = z.object({
  note: noteSchema,
  mode: z.enum(["llm", "clarification"]),
});
export const guideUrl =
  "https://www.opic.or.kr/opics/servlet/controller.opic.site.about.AboutServlet?p_process=move-introduce-opic";
