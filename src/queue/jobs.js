/**
 * @typedef {Object} PollJobData
 * @description Payload for the repeatable `discover` job. Empty by design —
 * the poll handler pulls every registered handle on each tick.
 */

// intentionally empty: marker so JSDoc parses the typedef above
{}

/**
 * @typedef {Object} JudgeJobData
 * @property {number} submissionId Primary key of the row in the `submissions`
 *   table that the judge worker should load and verdict.
 */

// intentionally empty: marker so JSDoc parses the typedef above
{}

export const Jobs = {};
