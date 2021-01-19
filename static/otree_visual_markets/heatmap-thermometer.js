import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { remap, clamp } from './utils.js';

class HeatmapThermometer extends PolymerElement {

    static get properties() {
        return {
            colorScheme:  Array,
            maxUtility: Number,
            currentUtility: Number,
            hoverUtility: Number,
        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    box-sizing: border-box;
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

            <div id="container">
                <canvas id="gradient_canvas"></canvas>
                <canvas id="indicator_canvas"></canvas>
            </div>
        `;
    }

    static get observers() {
        return [
            'drawGradient(width, height)',
            'drawIndicators(width, height, maxUtility, currentUtility, hoverUtility)',
        ];
    }

    ready() {
        super.ready();
        const resizeObserver = new ResizeObserver(entries => {
            const containerChange = entries[0];
            const width = Math.floor(containerChange.contentRect.width);
            const height = Math.floor(containerChange.contentRect.height);
            this.setSize(width, height);
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

    getGradientColor(percent) {
        percent = clamp(percent, 0, 1);
        const scheme = this.colorScheme;
        percent = percent * (scheme.length - 1)
        const low_index = Math.floor(percent)
        const high_index = Math.ceil(percent)
        percent = percent - low_index
        return [0, 1, 2].map(i => percent * scheme[high_index][i] + (1 - percent) * scheme[low_index][i])
    }

    drawGradient(width, height) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.gradient_canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let col = 0; col < width; col++) {
            const color = this.getGradientColor(col/width);
            for (let row = 0; row < height; row++) {
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


    drawIndicators(width, height, maxUtility, currentUtility, hoverUtility) {
        if ([width, height, maxUtility].some(e => typeof e === 'undefined')) return;

        const ctx = this.$.indicator_canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (currentUtility !== null && typeof currentUtility !== 'undefined') {
            const x = remap(currentUtility, 0, maxUtility, 0, width);
            ctx.strokeStyle = 'black';
            ctx.strokeWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        if (hoverUtility !== null && typeof hoverUtility !== 'undefined') {
            const x = remap(hoverUtility, 0, maxUtility, 0, width);
            ctx.strokeStyle = 'gray';
            ctx.strokeWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
}

window.customElements.define('heatmap-thermometer', HeatmapThermometer);