/*
 * mode.js: how much a stream can take. "anim" moves in place, "static" prints
 * one frame in colour, "plain" prints a line of text with no escape codes at all,
 * for pipes, CI logs and dumb terminals.
 */
const CI_VARS = ["CI", "GITHUB_ACTIONS", "BUILDKITE", "GITLAB_CI", "CIRCLECI", "TF_BUILD", "JENKINS_URL"];
const set = (v) => v !== undefined && v !== "" && v !== "0" && v !== "false";

/** True under a CI runner. */
export const isCI = (env = process.env) => CI_VARS.some((k) => set(env[k]));

/**
 * "plain" when the stream is not a TTY, under CI, with TERM=dumb or AMA_NO_INTRO set;
 * "static" with AMA_NO_MOTION set; otherwise "anim".
 */
export function mode(stream = process.stdout, env = process.env) {
  if (!stream || stream.isTTY !== true) return "plain";
  if (isCI(env) || env.TERM === "dumb" || set(env.AMA_NO_INTRO)) return "plain";
  if (set(env.AMA_NO_MOTION)) return "static";
  return "anim";
}

/** NO_COLOR (any value but empty) keeps the motion and drops the colour. */
export const colorOn = (env = process.env) => !env.NO_COLOR;
