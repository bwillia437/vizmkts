/**
 * utils.js - some useful functions for doing graphics stuff
 */

/**
 * linearly interpolate between two values
 *
 * @param {Number} a the low value to interpolate
 * @param {Number} b the high value to interpolate
 * @param {Number} t the mixing factor to choose between a and b
 */

 export const lerp = (a, b, t) => {
    return a + t * (b - a);
 }

/**
 * utility function to map a value from one range to another
 *
 * @param {Number} value the value to be re-mapped
 * @param {Number} lo1 the low value of the range to be mapped from
 * @param {Number} hi1 the high value of the range to be mapped from
 * @param {Number} lo2 the low value of the range to be mapped to
 * @param {Number} hi2 the high value of the range to be mapped to
 */
export const remap = (value, lo1, hi1, lo2, hi2) => {
    const t = (value - lo1) / (hi1 - lo1);
    return lerp(lo2, hi2, t);
};

/**
 * utility function to contain a value within some bounds
 *
 * @param {Number} value the value to be clamped
 * @param {Number} min the min value of the clamping range
 * @param {Number} max the max value of the clamping range
 */
export const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
}
