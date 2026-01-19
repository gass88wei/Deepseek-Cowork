'use strict';

var index = require('./index-gMG9ykdp.cjs');

const GEMINI_API_KEY_ENV = "GEMINI_API_KEY";
const GOOGLE_API_KEY_ENV = "GOOGLE_API_KEY";
const GEMINI_MODEL_ENV = "GEMINI_MODEL";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const CHANGE_TITLE_INSTRUCTION = index.trimIdent(
  `Based on this message, call functions.happy__change_title to change chat session title that would represent the current task. If chat idea would change dramatically - call this function again to update the title.`
);

exports.CHANGE_TITLE_INSTRUCTION = CHANGE_TITLE_INSTRUCTION;
exports.DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
exports.GEMINI_API_KEY_ENV = GEMINI_API_KEY_ENV;
exports.GEMINI_MODEL_ENV = GEMINI_MODEL_ENV;
exports.GOOGLE_API_KEY_ENV = GOOGLE_API_KEY_ENV;
