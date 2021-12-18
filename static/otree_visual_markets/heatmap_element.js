import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import '/static/otree-redwood/src/otree-constants/otree-constants.js';
import './lib/marchingsquares.js';
import './heatmap-thermometer.js';
import './currency_scaler.js';
import { remap, clamp, lerp } from './utils.js';

// radius of all circles representing bundles (current bundle, proposed bundle, current orders etc.)
const BUNDLE_CIRCLE_RADIUS = 7;

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
                    box-sizing: border-box;
                    display: block;
                    padding-right: 70px;
                    /* the width/height of the x and y axes */
                    --axis-size: 2em;
                    /* extra padding on the top/right of the heatmap to leave room for axis labels at extremes */
                    --axis-padding: 2em;
                }
                .thermometer-container {
                    position: absolute;
                    top: 0;
                    transform-origin: top right;
                    transform: rotate(-90deg);
                    width: 100%;
                    height: 60px;
                }
                /* these css rules make an element square, based on its width */
                .square-aspect {
                    height: 0;
                    padding-top: 100%;
                    position: relative;
                }
                .main_container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }
                .main_container > :last-child {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                #y_scale {
                    position: absolute;
                    width: var(--axis-size);
                    height: 100%;
                }
                #x_scale {
                    position: absolute;
                    top: calc(100% - var(--axis-size));
                    width: 100%;
                    height: var(--axis-size);
                }
                #heatmap_container {
                    top: var(--axis-padding);
                    left: var(--axis-size);
                    position: absolute;
                    width: calc(100% - var(--axis-size) - var(--axis-padding));
                    height: calc(100% - var(--axis-size) - var(--axis-padding));
                }
                #heatmap_container > canvas {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                }
            </style>

            <otree-constants
                id="constants"
            ></otree-constants>
            <currency-scaler
                id="currency_scaler"
            ></currency-scaler>

            <div class="square-aspect">
                <div class="thermometer-container">
                    <heatmap-thermometer
                        color-scheme="[[ colorScheme ]]"
                        max-utility="[[ maxUtility ]]"
                        current-utility="[[ currentUtility ]]"
                        hover-utility="[[ hoverUtility ]]"
                    ></heatmap-thermometer>
                </div>
                <div class="main_container">
                    <canvas id="y_scale"></canvas>
                    <div id="heatmap_container" on-mousemove="hover" on-mouseout="mouseout" on-click="click">
                        <!-- use stacked canvases as 'layers' so we can clear different elements individually -->
                        <canvas id="heatmap_canvas"></canvas>
                        <canvas id="hover_curve_canvas"></canvas>
                        <canvas id="current_bundle_canvas"></canvas>
                        <canvas id="order_canvas"></canvas>
                        <canvas id="proposed_bundle_canvas"></canvas>
                    </div>
                    <canvas id="x_scale"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    static get properties() {
        return {
            colorScheme: {
                type: Array,
                value: () => [
                    [0, 0, 200],
                    [60, 200, 80],
                    [220, 220, 30],
                    [220, 190, 100],
                    [255, 0, 0],
                ],
            },
            utilityFunction: {
                type: Object,
            },
            proposedX: Number,
            proposedY: Number,
            xBounds: Array,
            yBounds: Array,
            currentX: Number,
            currentY: Number,
            initialX: Number,
            initialY: Number,
            currentBid: Object,
            currentAsk: Object,
            bids: Array,
            asks: Array,
            maxUtility: Number,
            usePartialEquilibrium: Boolean,
            showMarketOnHeatmap: Boolean,
            end: Boolean,
            hoverUtility: {
                type: Number,
                computed: 'calcHoverUtility(mouseX, mouseY, currentX, currentY, utilityFunction, xBounds, yBounds, width, height)',
            },
            currentUtility: {
                type: Number,
                computed: 'calcCurrentUtility(currentX, currentY, utilityFunction, xBounds, yBounds)',
            },
            // the size in pixels of the grid that the indifference curves are evaluated over
            // a larger value is faster but results in blockier curves
            _quadTreeGridSize: {
                type: Number,
                value: 10,
            },
            quadTree: {
                type: Object,
                computed: 'computeQuadTree(utilityFunction, xBounds, yBounds, width, height)',
            }
        }
    }

    static get observers() {
        return [
            'drawHeatmap(utilityFunction, usePartialEquilibrium, xBounds, yBounds, maxUtility, width, height)',
            'drawHoverCurve(hoverUtility, width, height, quadTree)',
            'drawCurrentBundle(currentX, currentY, usePartialEquilibrium, currentUtility, xBounds, yBounds, width, height, quadTree)',
            'drawProposedBundle(proposedX, proposedY, xBounds, yBounds, width, height)',
            'drawInitialAllocation(initialX, initialY, xBounds, yBounds, width, height)',
            'drawOrders(bids.splices, asks.splices, currentBid, currentAsk, currentX, currentY, xBounds, yBounds, width, height)',
            'drawXAxis(xBounds, axisSize, axisPadding, width, height)',
            'drawYAxis(yBounds, axisSize, axisPadding, width, height)',
        ]
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;
        const resizeObserver = new ResizeObserver(entries => {
            const containerChange = entries[0];
            const width = Math.floor(containerChange.contentRect.width);
            const height = Math.floor(containerChange.contentRect.height);
            this.setSize(width, height);
        });
        resizeObserver.observe(this.$.heatmap_container);
    }

    setSize(width, height) {
        // we have to update this.width and this.height after waiting, since for some reason updating the canvas' widths and heights
        // doesn't happen until the next tick. changing this.width and this.height after waiting ensures that the canvases have correct
        // width and height properties when the polymer observers are triggered
        for (const canvas of this.$.heatmap_container.querySelectorAll('canvas')) {
            canvas.width = width;
            canvas.height = height;
        }

        // set width and height properties on scale canvases
        this.$.x_scale.width = this.$.x_scale.clientWidth;
        this.$.x_scale.height = this.$.x_scale.clientHeight;
        this.$.y_scale.width = this.$.y_scale.clientWidth;
        this.$.y_scale.height = this.$.y_scale.clientHeight;

        // retrieve axis size and axis padding values
        // these should equal the --axis-size and --axis-padding css variables, converted to pixels
        this.axisSize = this.$.x_scale.height;
        this.axisPadding = this.$.heatmap_container.offsetTop;

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
     * @param {CanvasRenderingContext2D} ctx A rendering context which is to be used to draw the curve
     * @param {MarchingSquaresJS.QuadTree} quadTree A quadtree object containing the utility data
     */
    drawIndifferenceCurve(utility, ctx, quadTree) {
        ctx.save();
        const gridSize = this._quadTreeGridSize;
        const paths = MarchingSquaresJS.isoLines(quadTree, utility, {noFrame: true});
        for (const path of paths) {
            ctx.beginPath();
            for (let i = 0; i < path.length; i++) {
                let [x, y] = path[i];
                // convert x and y returned by isoLines to screen space positions
                // right out of isoLines, the values returned are positions relative to the grid defined by _quadTreeGridSize
                // need to account for that, as well as the padding added in computeQuadTree
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
        ctx.restore();
    }

    /**
     * Update mouseX and mouseY variables. These variables are in 'screen coordinates', so their values
     * are in pixels and should be between 0 and width/height. Sometimes they'll be outside those bounds though
     * due to some weirdness with how mouseover works.
     * 
     * Throttle rate of update so hover curve update doesn't get called too frequently.
     * Not sure throttling is really required since curves are drawn pretty quickly, but it's
     * probably a good idea anyways.
     *
     * @param {*} e mousemove event
     */
    hover(e) {
        const now = performance.now();
        // throttle rate in ms
        // this value is the minimum amount of time between mouse updates
        const throttle_rate = 10;
        const updateMouse = () => {
            const boundingRect = this.$.heatmap_container.getBoundingClientRect();
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

    click(e) {
        const requiredProperties = [this.xBounds, this.yBounds, this.width, this.height];
        if (requiredProperties.some(e => typeof e === 'undefined')) return;

        const boundingRect = this.$.heatmap_container.getBoundingClientRect();
        const screenX = e.clientX - boundingRect.left;
        const screenY = e.clientY - boundingRect.top;

        if (this.showMarketOnHeatmap) {
            const clickedOrderOrNull = this.checkForOrderClick(screenX, screenY);
            if (clickedOrderOrNull) {
                const order = clickedOrderOrNull;
                if (order.pcode != this.pcode) {
                    this.dispatchEvent(new CustomEvent('order-click', {
                        detail: order,
                        bubbles: true,
                        composed: true
                    }));
                    return;
                }
            }
        }

        let x =  remap(screenX, 0, this.width, this.xBounds[0], this.xBounds[1]);
        x = clamp(Math.round(x), this.xBounds[0], this.xBounds[1]);
        let y = remap(screenY, 0, this.height, this.yBounds[1], this.yBounds[0]);
        y = clamp(Math.round(y), this.yBounds[0], this.yBounds[1]);

        this.dispatchEvent(new CustomEvent('heatmap-click', {
            detail: {x: x, y: y},
            bubbles: true,
            composed: true
        }));
    }

    /*
        This method takes an x and y location in screen space representing a click location and
        returns an order object if the click was close to an order, null otherwise
    */
    checkForOrderClick(x, y) {
        const bids = this.get('bids');
        for (let order of bids) {
            const orderAssetX = this.currentX - order.volume;
            const orderAssetY = this.currentY + order.price * order.volume;
            const orderScreenX = remap(orderAssetX, this.xBounds[0], this.xBounds[1], 0, this.width);
            const orderScreenY = remap(orderAssetY, this.yBounds[1], this.yBounds[0], 0, this.height);

            const dist = Math.hypot(orderScreenX - x, orderScreenY - y);
            if (dist < BUNDLE_CIRCLE_RADIUS + 1)
                return order;
        }

        const asks = this.get('asks');
        for (let order of asks) {
            const orderAssetX = this.currentX + order.volume;
            const orderAssetY = this.currentY - order.price * order.volume;
            const orderScreenX = remap(orderAssetX, this.xBounds[0], this.xBounds[1], 0, this.width);
            const orderScreenY = remap(orderAssetY, this.yBounds[1], this.yBounds[0], 0, this.height);

            const dist = Math.hypot(orderScreenX - x, orderScreenY - y);
            if (dist < BUNDLE_CIRCLE_RADIUS + 1)
                return order;
        }

        return null;
    }

    /**
     * Calculate the utility value currently being hovered over with the mouse
     */
    calcHoverUtility(mouseX, mouseY, currentX, currentY, utilityFunction, xBounds, yBounds, width, height) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        // if mouse coordinates aren't defined, or are outside the screen bounds, just return after clearing the hover canvas
        if (mouseX === null || mouseY === null || mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
            return null;
        }

        const x = remap(mouseX, 0, width, xBounds[0], xBounds[1]);
        const y = remap(mouseY, 0, height, yBounds[1], yBounds[0]);

        // if mouse position is in one of the 'impossible' quadrants, just return
        if ((x < currentX && y < currentY) || (x > this.currentX && y > this.currentY)) {
            return null;
        }

        return utilityFunction(x, y);
    }

    drawHoverCurve(hoverUtility, width, height, quadTree) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.hover_curve_canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (hoverUtility === null)
            return;

        this.drawIndifferenceCurve(hoverUtility, ctx, quadTree);
    }

    /**
     *  Calculate the players current utility value given their current X and Y holdings 
     */
    calcCurrentUtility(currentX, currentY, utilityFunction, xBounds, yBounds) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        if (currentX < xBounds[0] || currentX > xBounds[1] || currentY < yBounds[0] || currentY > yBounds[1]) {
            return null;
        }

        return utilityFunction(currentX, currentY);
    }

    drawCurrentBundle(currentX, currentY, usePartialEquilibrium, currentUtility, xBounds, yBounds, width, height, quadTree) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.current_bundle_canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (currentUtility === null) {
            return;
        }

        this.drawIndifferenceCurve(currentUtility, ctx, quadTree);

        // the current bundle in screen coordinates
        const screenX = remap(currentX, xBounds[0], xBounds[1], 0, width);
        const screenY = remap(currentY, yBounds[1], yBounds[0], 0, height);

        // draw greyed-out squares for impossible trades
        ctx.beginPath()
        ctx.rect(screenX, 0, width-screenX, screenY);
        ctx.rect(0, screenY, screenX, height-screenY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // draw circle centered at current bundle
        ctx.beginPath();
        ctx.arc(screenX, screenY, BUNDLE_CIRCLE_RADIUS, 0, 2*Math.PI);
        ctx.fillStyle = 'black';
        ctx.fill();

        if (usePartialEquilibrium) {
            this.drawPartialEquilibriumHashes(ctx, currentX, xBounds, width, currentUtility, quadTree);
        }
    }

    /**
     * Draw hash marks everywhere the player's current indifference curve intersects a line x = c where c is an integer
     */
    drawPartialEquilibriumHashes(ctx, currentX, xBounds, width, currentUtility, quadTree) {
        ctx.save();

        const gridSize = this._quadTreeGridSize;
        const paths = MarchingSquaresJS.isoLines(quadTree, currentUtility, {noFrame: true});
        ctx.lineWidth = 4;

        for (const path of paths) {
            // for each line segment in the indifference curve
            for (let i = 1; i < path.length; i++) {
                // prevX/Y and curX/Y are the start and end points of this line segment
                let [curX, curY] = path[i];
                curX = -gridSize + curX*gridSize;
                curY = -gridSize + curY*gridSize;

                let [prevX, prevY] = path[i-1];
                prevX = -gridSize + prevX*gridSize;
                prevY = -gridSize + prevY*gridSize;

                // map current and previous X values from screen space to asset space
                const curXAsset = remap(curX, 0, width, xBounds[0], xBounds[1]);
                const prevXAsset = remap(prevX, 0, width, xBounds[0], xBounds[1]);
                // if the leftmost endpoint's X value and the rightmost endpoint's X value straddle an integer value of X
                if (Math.ceil(Math.min(curXAsset, prevXAsset)) == Math.floor(Math.max(curXAsset, prevXAsset))) {
                    const xIntersectionPointAsset = Math.ceil(Math.min(curXAsset, prevXAsset));

                    if (xIntersectionPointAsset == currentX) continue;
                    else if (xIntersectionPointAsset < currentX) ctx.strokeStyle = 'lightgreen';
                    else if (xIntersectionPointAsset > currentX) ctx.strokeStyle = 'pink';

                    const xIntersectionPoint = remap(xIntersectionPointAsset, xBounds[0], xBounds[1], 0, width);
                    const yIntersectionPoint = remap(xIntersectionPoint, prevX, curX, prevY, curY);
                    ctx.beginPath();
                    ctx.moveTo(xIntersectionPoint - 5, yIntersectionPoint);
                    ctx.lineTo(xIntersectionPoint + 5, yIntersectionPoint)
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }

    drawProposedBundle(proposedX, proposedY, xBounds, yBounds, width, height) {
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.proposed_bundle_canvas.getContext('2d');
        
        if(this.end == true) { 
            return;
        }
        
        ctx.clearRect(0, 0, width, height);

        if (proposedX === null || proposedX === null)
            return;

        const screenX = remap(proposedX, xBounds[0], xBounds[1], 0, width);
        const screenY = remap(proposedY, yBounds[1], yBounds[0], 0, height);

        ctx.beginPath();
        ctx.arc(screenX, screenY, BUNDLE_CIRCLE_RADIUS, 0, 2*Math.PI);
        ctx.fillStyle = 'orange';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
    }

    drawInitialAllocation(initialX, initialY, xBounds, yBounds, width, height) {
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const ctx = this.$.proposed_bundle_canvas.getContext('2d');
        ctx.save();

        if (initialX === null || initialY === null)
            return;

        this.setProperties({
            end: true
        });

        const screenX = remap(initialX, xBounds[0], xBounds[1], 0, width);
        const screenY = remap(initialY, yBounds[1], yBounds[0], 0, height);

        ctx.beginPath();
        ctx.arc(screenX, screenY, BUNDLE_CIRCLE_RADIUS, 0, 2*Math.PI);
        ctx.fillStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /*
        draw this player's current bid and ask if they exist
    */
    drawCurrentOrders(ctx, currentBid, currentAsk, currentX, currentY, xBounds, yBounds, width, height) {
        ctx.save();
        ctx.lineWidth = 2;

        if (currentBid) {
            const x = currentX + currentBid.volume;
            const y = currentY - currentBid.price * currentBid.volume;

            const screenX = remap(x, xBounds[0], xBounds[1], 0, width);
            const screenY = remap(y, yBounds[1], yBounds[0], 0, height);

            ctx.beginPath();
            ctx.arc(screenX, screenY, BUNDLE_CIRCLE_RADIUS, 0, 2*Math.PI);
            ctx.fillStyle = '#ffb3b3';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        }

        if (currentAsk) {
            const x = currentX - currentAsk.volume;
            const y = currentY + currentAsk.price * currentAsk.volume;

            const screenX = remap(x, xBounds[0], xBounds[1], 0, width);
            const screenY = remap(y, yBounds[1], yBounds[0], 0, height);

            ctx.beginPath();
            ctx.arc(screenX, screenY, BUNDLE_CIRCLE_RADIUS, 0, 2*Math.PI);
            ctx.fillStyle = '#c6ffb3';
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    /*
        draws the order book as a segmented line representing what your bundle would be if you accepted
        each order currently in the book. also draw a circle representing each order
    */
    drawMarket(ctx, bids, asks, currentX, currentY, xBounds, yBounds, width, height) {
        ctx.save();
        ctx.lineWidth = 2;
        let x, y;

        // performs a given drawing context operation in asset space by converting
        // x and y to screen space and passing arguments through
        const ctxOpInAssetSpace = (op, x, y, ...rest) => {
            const screenX = remap(x, xBounds[0], xBounds[1], 0, width);
            const screenY = remap(y, yBounds[0], yBounds[1], height, 0);
            op.bind(ctx)(screenX, screenY, ...rest);
        };

        // draw segmented line connecting orders
        // have to do this first so that order circles are drawn on top
        ctx.beginPath();
        x = currentX;
        y = currentY;
        ctxOpInAssetSpace(ctx.moveTo, x, y);
        for (const bid of bids) {
            if (bid.pcode == this.pcode) continue;

            x -= bid.volume;
            y += bid.price * bid.volume;
            ctxOpInAssetSpace(ctx.lineTo, x, y);
        }
        ctx.stroke();

        // draw circles for each order
        x = currentX;
        y = currentY;
        ctx.fillStyle = 'green';
        for (const bid of bids) {
            if (bid.pcode == this.pcode) continue;

            x -= bid.volume;
            y += bid.price * bid.volume;
            ctx.beginPath();
            ctxOpInAssetSpace(ctx.arc, x, y, BUNDLE_CIRCLE_RADIUS, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }

        // repeat for asks
        ctx.beginPath();
        x = currentX;
        y = currentY;
        ctxOpInAssetSpace(ctx.moveTo, x, y);
        for (const ask of asks) {
            if (ask.pcode == this.pcode) continue;

            x += ask.volume;
            y -= ask.price * ask.volume;
            ctxOpInAssetSpace(ctx.lineTo, x, y);
        }
        ctx.stroke();

        x = currentX;
        y = currentY;
        ctx.fillStyle = 'red';
        for (const bid of asks) {
            if (bid.pcode == this.pcode) continue;

            x += bid.volume;
            y -= bid.price * bid.volume;
            ctx.beginPath();
            ctxOpInAssetSpace(ctx.arc, x, y, BUNDLE_CIRCLE_RADIUS, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    drawOrders(_bidSplices, _askSplices, currentBid, currentAsk, currentX, currentY, xBounds, yBounds, width, height) {
        const requiredProperties = [currentBid, currentAsk, currentX, currentY, xBounds, yBounds, width, height];
        if (requiredProperties.some(e => typeof e === 'undefined')) return;

        const ctx = this.$.order_canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        if (this.showMarketOnHeatmap) {
            const bids = this.get('bids');
            const asks = this.get('asks');

            this.drawMarket(ctx, bids, asks, currentX, currentY, xBounds, yBounds, width, height);
        }
        this.drawCurrentOrders(ctx, currentBid, currentAsk, currentX, currentY, xBounds, yBounds, width, height);
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
        return [0, 1, 2].map(i => lerp(scheme[low_index][i], scheme[high_index][i], percent));
    }

    /**
     * Generate the heatmap
     */
    drawHeatmap(utilityFunction, usePartialEquilibrium, xBounds, yBounds, maxUtility, width, height) {
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

        if (usePartialEquilibrium) {
            this.drawXLines(ctx, xBounds, width, height);
        }
    }

    drawXLines(ctx, xBounds, width, height) {
        ctx.strokeStyle = 'gray';
        ctx.beginPath();
        for (let x = xBounds[0]; x <= xBounds[1]; x++) {
            const screenX = remap(x, xBounds[0], xBounds[1], 0, width);
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
        }
        ctx.stroke();
    }

    // get an appropriate tick interval for an x or y axis given the bounds of that axis
    // intervals are chosen as 1, 2, 5 or a multiple of an appropriate power of 10
    getTickInterval(bounds) {
        const range = bounds[1] - bounds[0];
        const maxNumTicks = 20;
        for (const interval of [1, 2, 5]) {
            if (range / interval <= maxNumTicks) return interval;
        }
        let interval = 10;
        let base = 10;
        while (true) {
            for (let i = 0; i < 9; i++) {
                interval += base;
                if (range / interval <= maxNumTicks) return interval;
            }
            base *= 10;
        }
    }

    drawXAxis(xBounds, axisSize, axisPadding, _width, _height) {
        // _width and _height aren't used, they're just there so that the axes are redrawn when the size of the heatmap changes

        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const width = this.$.x_scale.width;
        const height = this.$.x_scale.height;

        const ctx = this.$.x_scale.getContext('2d');
        ctx.textBaseline = 'top'
        ctx.font = '15px sans-serif';
        ctx.beginPath();
        ctx.moveTo(axisSize-1, 1);
        ctx.lineTo(width-axisPadding, 1);

        const interval = this.getTickInterval(xBounds);
        let curTick = xBounds[0];
        while (curTick <= xBounds[1]) {
            const curTickPixels = remap(curTick, xBounds[0], xBounds[1], axisSize-1, width-axisPadding);
            ctx.moveTo(curTickPixels, 1);
            ctx.lineTo(curTickPixels, 20);
            const curTickText = this.$.currency_scaler.xToHumanReadable(curTick)
            ctx.fillText(curTickText, curTickPixels + 5, 5)
            curTick += interval;
        }

        ctx.stroke();
    }

    drawYAxis(yBounds, axisSize, axisPadding, _width, _height) {
        // _width and _height aren't used, they're just there so that the axes are redrawn when the size of the heatmap changes

        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const width = this.$.y_scale.width;
        const height = this.$.y_scale.height;

        const ctx = this.$.y_scale.getContext('2d');
        ctx.textAlign = 'right';
        ctx.font = '15px sans-serif';
        ctx.beginPath();
        ctx.moveTo(width-1, axisPadding);
        ctx.lineTo(width-1, height-axisSize+1);

        const interval = this.getTickInterval(yBounds);
        let curTick = yBounds[0];
        while (curTick <= yBounds[1]) {
            const curTickPixels = remap(curTick, yBounds[0], yBounds[1], height-axisSize+1, axisPadding);
            ctx.moveTo(width, curTickPixels);
            ctx.lineTo(width - 20, curTickPixels);
            const curTickText = this.$.currency_scaler.yToHumanReadable(curTick)
            ctx.fillText(curTickText, width-5, curTickPixels - 5)
            curTick += interval;
        }

        ctx.stroke();
    }

    computeQuadTree(utilityFunction, xBounds, yBounds, width, height) {
        // if any arguments are undefined, just return
        if (Array.from(arguments).some(e => typeof e === 'undefined')) return;

        const gridSize = this._quadTreeGridSize;
        const data = [];
        // evaluate utility across full width and height, in increments of gridSize
        // add 2 * gridSize to width and height for some padding, so the grid always extends past the edges of the canvas
        for (let row = -gridSize; row < height+2*gridSize; row += gridSize) {
            data.push([]);
            for (let col = -gridSize; col < width+2*gridSize; col += gridSize) {
                let x = remap(col, 0, width,  xBounds[0], xBounds[1]);
                x = clamp(x, xBounds[0], xBounds[1]);
                let y = remap(row, 0, height, yBounds[1], yBounds[0])
                y = clamp(y, yBounds[0], yBounds[1]);

                const utility = utilityFunction(x, y);
                data[data.length-1].push(utility);
            }
        }
        return new MarchingSquaresJS.QuadTree(data);
    }

    _periodEnd(_event) {
        console.log("end");
    }
}

window.customElements.define('heatmap-element', HeatmapElement)