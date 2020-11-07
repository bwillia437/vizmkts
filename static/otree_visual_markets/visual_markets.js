import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import '/static/otree-redwood/src/redwood-channel/redwood-channel.js';
import '/static/otree-redwood/src/otree-constants/otree-constants.js';

import '/static/otree_markets/trader_state.js'
import '/static/otree_markets/order_list.js';
import '/static/otree_markets/trade_list.js';
import '/static/otree_markets/simple_modal.js';
import '/static/otree_markets/event_log.js';

import './heatmap_element.js';

class VisualMarkets extends PolymerElement {

    static get properties() {
        return {
            utilityFunctionString: String,
            utilityFunction: {
                type: Object,
                computed: 'computeUtilityFunction(utilityFunctionString)',
            },
            maxUtility: Number,
            xBounds: Array,
            yBounds: Array,
            bids: Array,
            asks: Array,
            trades: Array,
            settledX: Number,
            availableX: Number,
            settledY: Number,
            availableY: Number,
            proposedX: Number,
            proposedY: Number,
        };
    }

    static get template() {
        return html`
            <style>
                * {
                    box-sizing: border-box;
                }
                .full-width {
                    width: 100vw;
                    margin-left: 50%;
                    transform: translateX(-50%);
                }
                .flex-fill {
                    flex: 1 0 0;
                    min-height: 0;
                }

                .main-container {
                    display: flex;
                    justify-content: space-evenly;
                    padding: 10px;
                }
                .main-container > div {
                    margin: 5px;
                    display: flex;
                    flex-direction: column;
                }
                .list-cell {
                    flex: 0 1 15%;
                }
                .heatmap-cell {
                    flex: 1;
                    max-width: 80vh;
                }

                order-list, trade-list, event-log, heatmap-element {
                    border: 1px solid black;
                }

                /* these css rules make an element square, based on its width */
                .square-aspect {
                    height: 0;
                    width: 100%;
                    padding-top: 100%;
                    position: relative;
                }
                .square-aspect > * {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .info-table {
                    text-align: center;
                }
            </style>

            <simple-modal
                id="modal"
            ></simple-modal>
            <otree-constants
                id="constants"
            ></otree-constants>
            <trader-state
                id="trader_state"
                bids="{{bids}}"
                asks="{{asks}}"
                trades="{{trades}}"
                settled-assets="{{settledX}}"
                available-assets="{{availableX}}"
                settled-cash="{{settledY}}"
                available-cash="{{availableY}}"
            ></trader-state>

            <div class="full-width">
                <div class="main-container">
                    <div class="list-cell">
                        <h3>Bids</h3>
                        <order-list
                            class="flex-fill"
                            orders="[[bids]]"
                            on-order-canceled="_order_canceled"
                            on-order-accepted="_order_accepted"
                        ></order-list>
                        <div>
                            <div on-input="_updateProposedBundleBid">
                                <div>
                                    <label for="bid_price_input">Price</label>
                                    <input id="bid_price_input" type="number" min="0">
                                </div>
                                <div>
                                    <label for="bid_volume_input">Volume</label>
                                    <input id="bid_volume_input" type="number" min="1">
                                </div>
                            </div>
                            <div>
                                <button type="button" on-click="_enter_bid">Enter Bid</button>
                            </div>
                        </div>
                    </div>
                    <div class="list-cell">
                        <h3>Trades</h3>
                        <trade-list
                            class="flex-fill"
                            trades="[[trades]]"
                        ></trade-list>
                    </div>
                    <div class="list-cell">
                        <h3>Asks</h3>
                        <order-list
                            class="flex-fill"
                            orders="[[asks]]"
                            on-order-canceled="_order_canceled"
                            on-order-accepted="_order_accepted"
                        ></order-list>
                        <div>
                            <div on-input="_updateProposedBundleAsk">
                                <div>
                                    <label for="ask_price_input">Price</label>
                                    <input id="ask_price_input" type="number" min="0">
                                </div>
                                <div>
                                    <label for="ask_volume_input">Volume</label>
                                    <input id="ask_volume_input" type="number" min="1">
                                </div>
                            </div>
                            <div>
                                <button type="button" on-click="_enter_ask">Enter Ask</button>
                            </div>
                        </div>
                    </div>
                    <div class="heatmap-cell">
                        <div class="square-aspect">
                            <heatmap-element
                                id="heatmap"
                                utility-function="[[ utilityFunction ]]"
                                x-bounds="[[ xBounds ]]"
                                y-bounds="[[ yBounds ]]"
                                current-x="[[ settledX ]]"
                                current-y="[[ settledY ]]"
                                max-utility="[[ maxUtility ]]"
                                proposed-x="[[ proposedX ]]"
                                proposed-y="[[ proposedY ]]"
                                on-heatmap-click="onHeatmapClick"
                            ></heatmap-element>
                        </div>
                    </div>
                </div>
                <div class="info-table">
                    <span>Settled X: [[settledX]]</span>
                    <span>Available X: [[availableX]]</span>
                    <span>Settled Y: [[settledY]]</span>
                    <span>Available Y: [[availableY]]</span>
                </div>
            </div>
        `;
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;
    }
    
    computeUtilityFunction(utilityFunctionString) {
        return new Function('x', 'y', 'return ' + utilityFunctionString);
    }

    onHeatmapClick(e) {
        // this takes some explanation..
        // we need it to be actually possible to move from the current bundle to the proposed one.
        // the restriction is that order prices and volumes have to be integers.
        // so when we calculate the proposed Y, we actually calculate the nearest Y to the click
        // which is an integer multiple of the difference in X between the current X and the proposed X.
        const proposedX = e.detail.x;
        if (proposedX == this.settledX)
            return;

        const xDist = proposedX - this.settledX;
        const proposedY = this.settledY + xDist * Math.round((e.detail.y - this.settledY) / xDist);
        if (proposedY == this.settledY)
            return;

        // if the calculated proposed bundle is in either of the 'impossible' quadrants, just return
        if ((proposedX > this.settledX && proposedY > this.settledY) || (proposedX < this.settledX && proposedY < this.settledY))
            return;

        this.setProperties({
            proposedX: proposedX,
            proposedY: proposedY,
        });

        // calculate the required trade to move from the current bundle to the proposed one
        if (proposedX > this.settledX) {
            const volume = proposedX - this.settledX;
            const price = Math.round((this.settledY - proposedY) / volume);
            this.$.bid_volume_input.value = volume;
            this.$.bid_price_input.value = price;
            
            this.$.ask_volume_input.value = '';
            this.$.ask_price_input.value = '';
        }
        else {
            const volume = this.settledX - proposedX;
            const price = Math.round((proposedY - this.settledY) / volume);
            this.$.ask_volume_input.value = volume;
            this.$.ask_price_input.value = price;

            this.$.bid_volume_input.value = '';
            this.$.bid_price_input.value = '';
        }
    }

    _updateProposedBundleBid() {
        const price = parseInt(this.$.bid_price_input.value);
        const volume = parseInt(this.$.bid_volume_input.value);
        if (isNaN(price) || price < 0 || isNaN(volume) || volume < 0) {
            this.setProperties({
                proposedX: null,
                proposedY: null,
            })
            return;
        }
        
        this.setProperties({
            proposedX: this.settledX + volume,
            proposedY: this.settledY - price * volume,
        });
    }

    _updateProposedBundleAsk() {
        const price = parseInt(this.$.ask_price_input.value);
        const volume = parseInt(this.$.ask_volume_input.value);
        if (isNaN(price) || price < 0 || isNaN(volume) || volume < 0) {
            this.setProperties({
                proposedX: null,
                proposedY: null,
            })
            return;
        }
        
        this.setProperties({
            proposedX: this.settledX - volume,
            proposedY: this.settledY + price * volume,
        });
    }

    _enter_bid() {
        const price = parseInt(this.$.bid_price_input.value);
        if (isNaN(price) || price < 0) {
            // this.$.log.error('Can\'t enter bid: invalid price');
            return;
        }

        const volume = parseInt(this.$.bid_volume_input.value);
        if (isNaN(volume) || volume < 0) {
            // this.$.log.error('Can\'t enter bid: invalid volume');
            return;
        }

        this.$.trader_state.enter_order(price, volume, true);
    }

    _enter_ask() {
        const price = parseInt(this.$.ask_price_input.value);
        if (isNaN(price) || price < 0) {
            // this.$.log.error('Can\'t enter ask: invalid price');
            return;
        }

        const volume = parseInt(this.$.ask_volume_input.value);
        if (isNaN(volume) || volume < 0) {
            // this.$.log.error('Can\'t enter ask: invalid volume');
            return;
        }

        this.$.trader_state.enter_order(price, volume, false);
    }

    // triggered when this player cancels an order
    _order_canceled(event) {
        const order = event.detail;

        this.$.modal.modal_text = 'Are you sure you want to remove this order?';
        this.$.modal.on_close_callback = (accepted) => {
            if (!accepted)
                return;

            this.$.trader_state.cancel_order(order);
        };
        this.$.modal.show();
    }

    // triggered when this player accepts someone else's order
    _order_accepted(event) {
        const order = event.detail;
        if (order.pcode == this.pcode)
            return;

        this.$.modal.modal_text = `Do you want to ${order.is_bid ? 'sell' : 'buy'} ${order.volume} units for $${order.price}?`
        this.$.modal.on_close_callback = (accepted) => {
            if (!accepted)
                return;

            this.$.trader_state.accept_order(order);
        };
        this.$.modal.show();
    }
}

window.customElements.define('visual-markets', VisualMarkets);
