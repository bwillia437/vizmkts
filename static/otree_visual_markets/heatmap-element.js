import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import './lib/marchingsquares.js'

/**
 * utility function to map a value from one range to another
 *
 * @param {Number} value the value to be re-mapped
 * @param {Number} lo1 the low value of the range to be mapped from
 * @param {Number} hi1 the high value of the range to be mapped from
 * @param {Number} lo2 the low value of the range to be mapped to
 * @param {Number} hi2 the high value of the range to be mapped to
 */
const remap = (value, lo1, hi1, lo2, hi2) => {
    const t = (value - lo1) / (hi1 - lo1);
    return lo2 + t * (hi2 - lo2);
};

/**
 * utility function to contain a value within some bounds
 *
 * @param {Number} value the value to be clamped
 * @param {Number} min the min value of the clamping range
 * @param {Number} max the max value of the clamping range
 */
const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
}

/**
 * `heatmap-element`
 * heatmap for oTree Visual Markets
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
class HeatmapElement extends PolymerElement {
    static get template() {
        return html`
            <style>
                :host {
                    display: block;
                }
                #container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                #container > canvas {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                }
            </style>
            
            <div id="container" on-mousemove="hover" on-mouseout="mouseout">
                <canvas id="heatmap_canvas"></canvas>
                <canvas id="current_curve_canvas"></canvas>
                <canvas id="hover_curve_canvas"></canvas>
            </div>
        `;
    }

    static get properties() {
        return {
            colorScheme: {
                type: Array,
                value: () => [
                    [255, 255, 255],
                    [255, 0, 0],
                ],
            },
            utilityFunction: {
                type: Object,
                value: function () {
                    return (x, y) => 100 * x ** 0.5 * y ** 0.5;
                }
            },
            xBounds: Array,
            yBounds: Array,
            currentX: Number,
            currentY: Number,
            maxUtility: Number,
            // the size in pixels of the grid that the indifference curves are evaluated over
            // a larger value is faster but results in blockier curves
            _quadTreeGridSize: {
                type: Number,
                value: 10,
            },
            _quadTree: {
                type: Object,
                computed: 'computeQuadTree(_quadTreeGridSize, utilityFunction, xBounds, yBounds, width, height)',
            }
        }
    }

    static get observers() {
        return [
            'drawHeatmap(utilityFunction, xBounds, yBounds, maxUtility, width, height)',
            'drawHoverCurve(mouseX, mouseY, utilityFunction, xBounds, yBounds, width, height, _quadTree)',
        ]
    }

    ready() {
        super.ready();
        const resizeObserver = new ResizeObserver(entries => {
            entries.forEach(e => {
                const width = Math.floor(e.contentRect.width);
                const height = Math.floor(e.contentRect.height);
                this.setSize(width, height);
            });
        });
        resizeObserver.observe(this.$.container);
    }

    setSize(width, height) {
        // we have to update this.width and this.height after waiting, since for some reason updating the canvas' widths and heights
        // doesn't happen until the next tick. changing this.width and this.height after waiting ensures that the canvases have correct
        // width and height properties when the polymer observers are triggered
        for (const canvas of this.$.container.querySelectorAll('canvas')) {
            canvas.width = width;
            canvas.height = height;
        }
        setTimeout(() => {
            this.setProperties({
                width: width,
                height: height,
            });
        });
    }

    /**
     * Draw an indifference curve for a given utility value
     * 
     * @param {Number} utility The utility value this indifference curve goes through
     * @param {Node} canvas The canvas element this indifference curve is to be drawn on
     * @param {MarchingSquaresJS.QuadTree} quadTree A quadtree object containing the utility data
     * @param {Number} width The width of the canvas
     * @param {Number} height The height of the canvas
     */
    drawIndifferenceCurve(utility, canvas, quadTree) {
        console.log(utility);
        const ctx = canvas.getContext('2d');
        const gridSize = this._quadTreeGridSize;
        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const paths = MarchingSquaresJS.isoLines(quadTree, utility, {noFrame: true});
        for (const path of paths) {
            ctx.beginPath();
            for (let i = 0; i < path.length; i++) {
                let [x, y] = path[i];
                x = -gridSize + x*gridSize;
                y = -gridSize + y*gridSize;
                if (i == 0) {
                    ctx.moveTo(x, y);
                }
                else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    }

    /**
     * Update mouseX and mouseY variables
     * Throttle rate of update so js doesn't get overloaded
     *
     * @param {*} e mousemove event
     */
    hover(e) {
        const now = performance.now();
        const throttle_rate = 10;
        const updateMouse = () => {
            const boundingRect = this.$.container.getBoundingClientRect();
            this.mouseX = e.clientX - boundingRect.left;
            this.mouseY = e.clientY - boundingRect.top;
            this.last_hover = now;
        }
        clearTimeout(this.hover_timeout);
        this.hover_timeout = setTimeout(updateMouse, this.last_hover + throttle_rate - now);
    }

    /**
     * Clear mouseX and mouseY variables when mouse leaves the heatmap
     */
    mouseout() {
        clearTimeout(this.hover_timeout);
        this.mouseX = null;
        this.mouseY = null;
    }

    drawHoverCurve(mouseX, mouseY, utilityFunction, xBounds, yBounds, width, height, quadTree) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        if (mouseX === null || mouseY === null) {
            const ctx = this.$.hover_curve_canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            return;
        }

        const x = remap(mouseX, 0, width, xBounds[0], xBounds[1]);
        const y = remap(mouseY, 0, height, yBounds[1], yBounds[0]);
        const utility = utilityFunction(x, y);
        this.drawIndifferenceCurve(utility, this.$.hover_curve_canvas, quadTree, width, height);
    }

    /**
     * gets colors from the gradient defined by this.colorScheme
     * 0.0 <= percent <= 1.0
     * where percent = 1.0 gets the last color in color_stops and percent = 0.0 gets the first color in color_stops
     *
     * @param {*} percent value to get from gradient
     */
    getGradientColor(percent) {
        percent = clamp(percent, 0, 1);
        const scheme = this.colorScheme;
        percent = percent * (scheme.length - 1)
        const low_index = Math.floor(percent)
        const high_index = Math.ceil(percent)
        percent = percent - low_index
        return [0, 1, 2].map(i => percent * scheme[high_index][i] + (1 - percent) * scheme[low_index][i])
    }

    /**
     * Generate the heatmap
     */
    drawHeatmap(utilityFunction, xBounds, yBounds, maxUtility, width, height) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.heatmap_canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        // iterate through every pixel in the image in row major order
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const x = remap(col, 0, width, xBounds[0], xBounds[1]);
                const y = remap(row, 0, height, yBounds[1], yBounds[0]);
                const utility = utilityFunction(x, y);
                var percent = utility / maxUtility;

                const color = this.getGradientColor(percent);

                const index = (row * width * 4) + (col * 4);
                data[index    ] = color[0];
                data[index + 1] = color[1];
                data[index + 2] = color[2];
                // set alpha channel to fully opaque
                data[index + 3] = 255
            }
        }

        // Display heatmap
        ctx.putImageData(imageData, 0, 0);
    }

    computeQuadTree(gridSize, utilityFunction, xBounds, yBounds, width, height) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const data = [];
        for (let row = -gridSize; row < height+2*gridSize; row += gridSize) {
            data.push([]);
            for (let col = -gridSize; col < width+2*gridSize; col += gridSize) {
                const x = remap(col, 0, width,  xBounds[0], xBounds[1]);
                const y = remap(row, 0, height, yBounds[1], yBounds[0]);
                const utility = utilityFunction(x, y);
                data[data.length-1].push(utility);
            }
        }
        return new MarchingSquaresJS.QuadTree(data);
    }
}

window.customElements.define('heatmap-element', HeatmapElement)