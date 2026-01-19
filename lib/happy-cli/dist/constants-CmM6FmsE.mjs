import { t as trimIdent } from './index-Rxv9jgYl.mjs';

const GEMINI_API_KEY_ENV = "GEMINI_API_KEY";
const GOOGLE_API_KEY_ENV = "GOOGLE_API_KEY";
const GEMINI_MODEL_ENV = "GEMINI_MODEL";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const CHANGE_TITLE_INSTRUCTION = trimIdent(
  `Based on this message, call functions.happy__change_title to change chat session title that would represent the current task. If chat idea would change dramatically - call this function again to update the title.`
);

export { CHANGE_TITLE_INSTRUCTION as C, DEFAULT_GEMINI_MODEL as D, GEMINI_MODEL_ENV as G, GEMINI_API_KEY_ENV as a, GOOGLE_API_KEY_ENV as b };
