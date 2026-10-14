'use strict';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const FLAT_BLOCK_INDEX = 3;

function assertNumericValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('values must be a non-empty array of numbers');
  }
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('values must contain only finite numbers');
    }
  }
}

/**
 * Renders a series of numbers as a single-line Unicode block sparkline,
 * scaling each value between the series' own min and max so a shape is
 * always visible regardless of the metric's absolute units.
 *
 * Deterministic: the same input array always renders the same string,
 * independent of which metric or units the values represent.
 *
 * @param {number[]} values - series to render, oldest first.
 * @returns {string} one block character per value.
 */
function renderSparkline(values) {
  assertNumericValues(values);

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return BLOCKS[FLAT_BLOCK_INDEX].repeat(values.length);
  }

  return values
    .map((value) => {
      const ratio = (value - min) / (max - min);
      const index = Math.round(ratio * (BLOCKS.length - 1));
      return BLOCKS[index];
    })
    .join('');
}

module.exports = { renderSparkline, BLOCKS };
