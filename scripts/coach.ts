#!/usr/bin/env bun

import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  type CoachLesson,
  type CoachLevel,
  type CoachMode,
  type CoachTopic,
  COACH_LESSONS,
  getLessons,
} from "./coach-content";

interface CliArgs {
  topic?: CoachTopic;
  mode?: CoachMode;
  level?: CoachLevel;
  lessonId?: string;
  completeLessonId?: string;
  listOnly: boolean;
  statusOnly: boolean;
  nextOnly: boolean;
  resetProgress: boolean;
  help: boolean;
}

interface CoachProgressState {
  completedLessonIds: string[];
  updatedAt: string;
}

const PROGRESS_FILE = ".coach-progress.json";

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    listOnly: false,
    statusOnly: false,
    nextOnly: false,
    resetProgress: false,
    help: false,
  };

  for (const token of argv) {
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--list") {
      args.listOnly = true;
      continue;
    }
    if (token === "--status") {
      args.statusOnly = true;
      continue;
    }
    if (token === "--next") {
      args.nextOnly = true;
      continue;
    }
    if (token === "--reset-progress") {
      args.resetProgress = true;
      continue;
    }

    const [key, value] = token.split("=");
    if (!value) continue;

    if (key === "--topic" && (value === "ts" || value === "py")) {
      args.topic = value;
    } else if (
      key === "--mode" &&
      (value === "explain" || value === "quiz" || value === "exercise")
    ) {
      args.mode = value;
    } else if (
      key === "--level" &&
      (value === "beginner" || value === "intermediate")
    ) {
      args.level = value;
    } else if (key === "--lesson") {
      args.lessonId = value;
    } else if (key === "--complete") {
      args.completeLessonId = value;
    }
  }

  return args;
}

async function loadProgress(): Promise<CoachProgressState> {
  if (!existsSync(PROGRESS_FILE)) {
    return { completedLessonIds: [], updatedAt: new Date(0).toISOString() };
  }
  try {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CoachProgressState>;
    const completedLessonIds = Array.isArray(parsed.completedLessonIds)
      ? parsed.completedLessonIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      completedLessonIds,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return { completedLessonIds: [], updatedAt: new Date(0).toISOString() };
  }
}

async function saveProgress(state: CoachProgressState): Promise<void> {
  await writeFile(PROGRESS_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function progressSummary(state: CoachProgressState): {
  completed: number;
  total: number;
  percent: number;
  tsCompleted: number;
  pyCompleted: number;
} {
  const completedSet = new Set(state.completedLessonIds);
  const total = COACH_LESSONS.length;
  const completed = COACH_LESSONS.filter((l) => completedSet.has(l.id)).length;
  const tsCompleted = COACH_LESSONS.filter(
    (l) => l.topic === "ts" && completedSet.has(l.id)
  ).length;
  const pyCompleted = COACH_LESSONS.filter(
    (l) => l.topic === "py" && completedSet.has(l.id)
  ).length;
  const percent = total > 0 ? (completed / total) * 100 : 0;
  return { completed, total, percent, tsCompleted, pyCompleted };
}

function printStatus(state: CoachProgressState) {
  const summary = progressSummary(state);
  console.log("\nLearning Coach Progress");
  console.log("-----------------------");
  console.log(
    `Completed lessons: ${summary.completed}/${summary.total} (${summary.percent.toFixed(
      1
    )}%)`
  );
  console.log(`TypeScript completed: ${summary.tsCompleted}/5`);
  console.log(`Python completed: ${summary.pyCompleted}/5`);
  console.log(`Last update: ${state.updatedAt}`);

  const completedSet = new Set(state.completedLessonIds);
  const remaining = COACH_LESSONS.filter((lesson) => !completedSet.has(lesson.id));
  if (remaining.length === 0) {
    console.log("\nAll lessons completed. Great work.");
  } else {
    console.log("\nNext recommended lessons:");
    for (const lesson of remaining.slice(0, 3)) {
      console.log(`- ${lesson.id}: ${lesson.title}`);
    }
  }
  console.log("");
}

function printHelp() {
  console.log(`
Ask the Ancients Learning Coach

Usage:
  bun run coach
  bun run coach --topic=ts --mode=explain --level=intermediate
  bun run coach --topic=py --mode=exercise --level=beginner --lesson=py-02
  bun run coach --list
  bun run coach --status
  bun run coach --next
  bun run coach --complete=ts-01
  bun run coach --reset-progress

Flags:
  --topic=ts|py
  --mode=explain|quiz|exercise
  --level=beginner|intermediate
  --lesson=<lesson-id>
  --complete=<lesson-id>
  --status
  --next
  --reset-progress
  --list
  --help
`);
}

function printLessonList(lessons: CoachLesson[]) {
  if (lessons.length === 0) {
    console.log("No lessons matched your filters.");
    return;
  }
  console.log("Available lessons:");
  for (const lesson of lessons) {
    console.log(`- ${lesson.id} [${lesson.topic}/${lesson.mode}/${lesson.level}] ${lesson.title}`);
  }
}

function renderLesson(lesson: CoachLesson) {
  console.log("\n============================================================");
  console.log(`${lesson.title} (${lesson.id})`);
  console.log("============================================================");
  console.log(`Topic: ${lesson.topic.toUpperCase()} | Mode: ${lesson.mode} | Level: ${lesson.level}`);
  console.log(`\nObjective:\n- ${lesson.objective}`);

  console.log("\nRepo examples:");
  for (const ref of lesson.repoExamples) {
    console.log(`- ${ref}`);
  }

  console.log("\nWhy this matters:");
  for (const point of lesson.whyItMatters) {
    console.log(`- ${point}`);
  }

  console.log("\nConcept brief:");
  for (const line of lesson.conceptBrief) {
    console.log(`- ${line}`);
  }

  console.log("\nAnti-pattern:");
  console.log(lesson.antiPattern);
  console.log("\nBetter pattern:");
  console.log(lesson.betterPattern);

  console.log("\nQuiz prompt:");
  console.log(lesson.quizPrompt);

  console.log("\nExercise prompt:");
  console.log(lesson.exercisePrompt);

  console.log("\nDebug prompt:");
  console.log(lesson.debugPrompt);

  console.log("\nChecklist:");
  for (const item of lesson.checklist) {
    console.log(`- [ ] ${item}`);
  }

  console.log(`\nNext step:\n- ${lesson.nextStep}`);
  console.log("============================================================\n");
}

function parseChoice<T extends string>(inputValue: string, values: readonly T[]): T | null {
  const normalized = inputValue.trim().toLowerCase();
  const exact = values.find((v) => v === normalized);
  if (exact) return exact;

  const idx = Number.parseInt(normalized, 10);
  if (!Number.isNaN(idx) && idx >= 1 && idx <= values.length) {
    return values[idx - 1];
  }
  return null;
}

async function selectInteractive(): Promise<{
  topic: CoachTopic;
  mode: CoachMode;
  level: CoachLevel;
  lesson: CoachLesson | null;
}> {
  const rl = createInterface({ input, output });
  try {
    const topicValues = ["ts", "py"] as const;
    const modeValues = ["explain", "quiz", "exercise"] as const;
    const levelValues = ["beginner", "intermediate"] as const;

    const topicRaw = await rl.question(
      "Choose topic (1) ts, (2) py [default 1]: "
    );
    const topic =
      parseChoice(topicRaw || "1", topicValues) ??
      "ts";

    const modeRaw = await rl.question(
      "Choose mode (1) explain, (2) quiz, (3) exercise [default 1]: "
    );
    const mode =
      parseChoice(modeRaw || "1", modeValues) ??
      "explain";

    const levelRaw = await rl.question(
      "Choose level (1) beginner, (2) intermediate [default 1]: "
    );
    const level =
      parseChoice(levelRaw || "1", levelValues) ??
      "beginner";

    const lessons = getLessons(topic, mode, level);
    if (lessons.length === 0) {
      return { topic, mode, level, lesson: null };
    }

    console.log("\nMatching lessons:");
    lessons.forEach((lesson, idx) => {
      console.log(`${idx + 1}) ${lesson.id} - ${lesson.title}`);
    });
    const lessonRaw = await rl.question("Choose lesson number [default 1]: ");
    const lessonIdx = Number.parseInt(lessonRaw || "1", 10);
    const selected = lessons[Math.max(1, Math.min(lessons.length, lessonIdx)) - 1];
    return { topic, mode, level, lesson: selected };
  } finally {
    rl.close();
  }
}

function resolveLessonFromArgs(args: CliArgs): CoachLesson | null {
  if (args.lessonId) {
    return COACH_LESSONS.find((lesson) => lesson.id === args.lessonId) ?? null;
  }

  if (!args.topic || !args.mode || !args.level) return null;
  const matches = getLessons(args.topic, args.mode, args.level);
  return matches[0] ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const progress = await loadProgress();

  if (args.help) {
    printHelp();
    return;
  }

  if (args.listOnly) {
    printLessonList(COACH_LESSONS);
    return;
  }

  if (args.resetProgress) {
    const next: CoachProgressState = {
      completedLessonIds: [],
      updatedAt: new Date().toISOString(),
    };
    await saveProgress(next);
    console.log(`Progress reset in ${PROGRESS_FILE}`);
    return;
  }

  if (args.completeLessonId) {
    const exists = COACH_LESSONS.some((lesson) => lesson.id === args.completeLessonId);
    if (!exists) {
      console.log(`Unknown lesson id: ${args.completeLessonId}`);
      process.exitCode = 1;
      return;
    }
    const completedSet = new Set(progress.completedLessonIds);
    completedSet.add(args.completeLessonId);
    const next: CoachProgressState = {
      completedLessonIds: Array.from(completedSet).sort(),
      updatedAt: new Date().toISOString(),
    };
    await saveProgress(next);
    console.log(`Marked lesson complete: ${args.completeLessonId}`);
    printStatus(next);
    return;
  }

  if (args.statusOnly) {
    printStatus(progress);
    return;
  }

  if (args.nextOnly) {
    const completedSet = new Set(progress.completedLessonIds);
    const pool = COACH_LESSONS.filter((item) => {
      if (completedSet.has(item.id)) return false;
      if (args.topic && item.topic !== args.topic) return false;
      if (args.mode && item.mode !== args.mode) return false;
      if (args.level && item.level !== args.level) return false;
      return true;
    });
    const nextLesson = pool[0] ?? null;
    if (!nextLesson) {
      console.log("No unfinished lessons matched your filters.");
      return;
    }
    console.log(`Opening next lesson: ${nextLesson.id}`);
    renderLesson(nextLesson);
    return;
  }

  if (!args.topic && !args.mode && !args.level && !args.lessonId) {
    const selection = await selectInteractive();
    if (!selection.lesson) {
      console.log(
        `No lessons found for topic=${selection.topic}, mode=${selection.mode}, level=${selection.level}.`
      );
      return;
    }
    renderLesson(selection.lesson);
    return;
  }

  const lesson = resolveLessonFromArgs(args);
  if (!lesson) {
    console.log("No lesson matched your arguments.");
    printLessonList(
      COACH_LESSONS.filter((item) => {
        if (args.topic && item.topic !== args.topic) return false;
        if (args.mode && item.mode !== args.mode) return false;
        if (args.level && item.level !== args.level) return false;
        return true;
      })
    );
    process.exitCode = 1;
    return;
  }

  renderLesson(lesson);
}

main().catch((error) => {
  console.error("Coach failed:", error);
  process.exit(1);
});

