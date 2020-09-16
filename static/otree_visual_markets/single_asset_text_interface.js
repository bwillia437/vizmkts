import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import '/static/otree-redwood/src/redwood-channel/redwood-channel.js';
import '/static/otree-redwood/src/otree-constants/otree-constants.js';

import '/static/otree_markets/trader_state.js'
import '/static/otree_markets/order_list.js';
import '/static/otree_markets/trade_list.js';
import '/static/otree_markets/simple_modal.js';
import '/static/otree_markets/event_log.js';

import './order_enter_widget.js';
import './heatmap-element.js';

/*
    this component is a single-asset market, implemented using otree_markets' trader_state component and some of
    otree_markets' reusable UI widgets.
*/

class SingleAssetTextInterface extends PolymerElement {

    static get properties() {
        return {
            bids: Array,
            asks: Array,
            trades: Array,
            settledX: Number,
            availableX: Number,
            settledY: Number,
            availableY: Number,
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

                .container {
                    display: flex;
                    justify-content: space-evenly;
                }
                .container > div {
                    display: flex;
                    flex-direction: column;
                }
                .flex-fill {
                    flex: 1 0 0;
                    min-height: 0;
                }

                #main-container {
                    padding: 10px;
                }
                #main-container > div {
                    margin: 5px;
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

                .square-aspect {
                    height: 0;
                    width: 100%;
                    padding-top: 100%;
                    position: relative;
                }
                heatmap-element {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
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
                on-confirm-trade="_confirm_trade"
                on-confirm-cancel="_confirm_cancel"
                on-error="_handle_error"
            ></trader-state>

            <div class="full-width">
                <div class="container" id="main-container">
                    <div class="list-cell">
                        <h3>Bids</h3>
                        <order-list
                            class="flex-fill"
                            orders="[[bids]]"
                            on-order-canceled="_order_canceled"
                            on-order-accepted="_order_accepted"
                        ></order-list>
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
                    </div>
                    <div class="heatmap-cell">
                        <div class="square-aspect">
                            <heatmap-element
                                id="heatmap"
                                x-bounds="[0, 10]"
                                y-bounds="[0, 10]"
                                current-x="[[ settledX ]]"
                                current-y="[[ settledY ]]"
                                max-utility="1000"
                            ></heatmap-element>
                        </div>
                    </div>
                </div>
            </div>
            
        `;
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;
        this.$.heatmap.utilityFunction = (x, y) => 100 * x ** 0.5 * y ** 0.5;
    }

    // triggered when this player enters an order
    _order_entered(event) {
        const order = event.detail;
        if (isNaN(order.price) || isNaN(order.volume)) {
            this.$.log.error('Invalid order entered');
            return;
        }
        this.$.trader_state.enter_order(order.price, order.volume, order.is_bid);
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

        this.$.modal.modal_text = `Do you want to ${order.is_bid ? 'buy' : 'sell'} for $${order.price}?`
        this.$.modal.on_close_callback = (accepted) => {
            if (!accepted)
                return;

            this.$.trader_state.accept_order(order);
        };
        this.$.modal.show();
    }

    // react to the backend confirming that a trade occurred
    _confirm_trade(event) {
        const trade = event.detail;
        const all_orders = trade.making_orders.concat([trade.taking_order]);
        for (let order of all_orders) {
            if (order.pcode == this.pcode)
                this.$.log.info(`You ${order.is_bid ? 'bought' : 'sold'} ${order.traded_volume} ${order.traded_volume == 1 ? 'unit' : 'units'}`);
        }
    }

    // react to the backend confirming that an order was canceled
    _confirm_cancel(event) {
        const order = event.detail;
        if (order.pcode == this.pcode) {
            this.$.log.info(`You canceled your ${msg.is_bid ? 'bid' : 'ask'}`);
        }
    }

    // handle an error sent from the backend
    _handle_error(event) {
        let message = event.detail;
        this.$.log.error(message)
    }
}

window.customElements.define('single-asset-text-interface', SingleAssetTextInterface);
