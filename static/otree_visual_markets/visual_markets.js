import { html, PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import '/static/otree-redwood/node_modules/@polymer/polymer/lib/elements/dom-if.js';
import '/static/otree-redwood/src/redwood-channel/redwood-channel.js';
import '/static/otree-redwood/src/otree-constants/otree-constants.js';
import '/static/otree-redwood/src/redwood-period/redwood-period.js';

import '/static/otree_markets/trader_state.js'
import '/static/otree_markets/simple_modal.js';
import '/static/otree_markets/event_log.js';

import './heatmap_element.js';
import './currency_scaler.js';
import './filtered_order_list.js';
import './trade_dot.js';
import './filtered_trade_list.js';
import './utility-grid.js';

class VisualMarkets extends PolymerElement {
    
    static get properties() {
        return {
            utilityFunctionString: String,
            utilityFunction: {
                type: Object,
                computed: 'computeUtilityFunction(utilityFunctionString)',
            },
            initialX: Number,
            initialY: Number,
            maxUtility: Number,
            xBounds: Array,
            yBounds: Array,
            yBoundsGrid: Array,
            bids: Array,
            asks: Array,
            trades: Array,
            currentBid: {
                type: Object,
                value: null,
            },
            currentAsk: {
                type: Object,
                value: null,
            },
            orderText: {
                type: String,
                value: 'Enter Order'
            },
            currentX: Number,
            currentY: Number,
            proposedX: Number,
            proposedY: Number,
            initialXEnd: Number,
            initialYEnd: Number,
            // used to keep track of whether the current order is a bid when
            // using the single order entry box (ie when showOrderBook is false)
            standaloneOrderIsBid: Boolean, 
            heatmapEnabled: Boolean,
            staticGridEnabled: Boolean,
            showNBestOrders: Number,
            showNMostRecentTrades: Number,
            showOwnTradesOnly: Boolean,
            usePartialEquilibrium: Boolean,
            showMarketOnHeatmap: Boolean,
            disableInputEntry: Boolean,
            showOrderBook: Boolean,
            showTradeDot: Boolean,
            tradeBoxScale: Number,
            sortTrades: {
                type: Boolean,
                value: false,
            },
            isFinished: { // only after the period has finished
                type: Boolean,
                value: false,
            },
        };
    }

    // override attribute deserialization to make the way booleans work a little more intuitive
    // change it so that a nonexistent attribute or an attribute of "false" deserializes to false
    // and everything else deserializes to true. this makes passing booleans in from the template a lot easier.
    _deserializeValue(value, type) {
        if (type == Boolean) {
            return !(!value || value.toLowerCase() == 'false');
        }
        return super._deserializeValue(value, type);
    }

    static get template() {
        return html`
            <link rel="stylesheet" href="/static/otree_visual_markets/css/visual_markets.css">

            <currency-scaler
                id="currency_scaler"
            ></currency-scaler>
            <simple-modal
                id="modal"
            ></simple-modal>
            <otree-constants
                id="constants"
            ></otree-constants>
            <redwood-period
                on-period-end="_periodEnd"
                running="{{running}}"
            ></redwood-period>
            <trader-state
                id="trader_state"
                bids="{{bids}}"
                asks="{{asks}}"
                trades="{{trades}}"
                settled-assets="{{currentX}}"
                settled-cash="{{currentY}}"
                time-remaining="{{timeRemaining}}"
                on-error="_onError"
                on-confirm-order-enter="_confirmOrderEntered"
                on-confirm-order-cancel="_confirmOrderCanceled"
                on-confirm-trade="_confirmTrade"
            ></trader-state>

            <div class="full-width">
                <div class="header">
                    <div>
                        <span>Round </span>
                        <span>[[ roundNumber() ]]</span>
                    </div>
                    <div class="flex-padding"></div>
                    <div>
                        <span>Time Remaining:</span>
                        <span>[[ formatTimeRemaining(timeRemaining) ]]</span>
                    </div>
                </div>
                

                <div class="main-container">
                    <div class="left-side">
                        <template is="dom-if" if="{{showOrderBook}}">
                            <div class="list-container">
                                <div class="list-cell" style= "border-radius: 5px;border: 2px solid red;">
                                    <div class="Title" style= "background-color: red;">
                                        <h3>Bids</h3>
                                    </div>
                                    <filtered-order-list
                                        class="flex-fill"
                                        orders="[[bids]]"
                                        on-order-canceled="_order_canceled"
                                        on-order-accepted="_order_accepted"
                                        display-format="[[orderFormat]]"
                                        limit-num="[[showNBestOrders]]"
                                    ></filtered-order-list>
                                    <div style="margin:auto;">
                                        <div on-input="_updateProposedBundleBid">
                                            <div class ="pricevolumeinput" style="width: 90%;
                                            height: 30;">
                                                <label for="bid_price_input">Price: </label>
                                                <input id="bid_price_input" type="number" min="0" disabled = "[[checkDisabled(running)]]">
                                            </div>
                                            <div class ="pricevolumeinput" style="width:90%">
                                                <label for="bid_volume_input">Qty: </label>
                                                <input id="bid_volume_input" type="number" min="1" disabled = "[[checkDisabled(running)]]">
                                            </div>
                                        </div>
                                        <div>
                                            <button type="button" on-click="_enter_bid" style = "background: #E01936;" disabled="{{!running}}">Bid</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="list-cell" style= "border-radius: 5px;border: 2px solid grey; 
                                outline-offset: 0px;">
                                    <div class="Title" style= "background-color: grey;">
                                        <h3>Trades
                                        <template is="dom-if" if="{{isFinished}}">
                                            <label for="myCheck" style="box-shadow:none;">Sort Trades:</label> 
                                            <span><input type="checkbox" id="myCheck" autocomplete="off" on-click="sort"></span>
                                        </template>
                                        </h3>
                                    </div>
                                    <filtered-trade-list
                                        class="flex-fill"
                                        trades="[[trades]]"
                                        display-format="[[tradeFormat]]"
                                        limit-num="[[showNMostRecentTrades]]"
                                        show-own-only="[[showOwnTradesOnly]]"
                                        sort-trades="[[sortTrades]]"
                                    ></filtered-trade-list>
                                </div>
                                <div class="list-cell" style= "border-radius: 5px;border: 2px solid green; 
                                outline-offset: 0px;">
                                    <div class="Title" style= "background-color: green;">
                                        <h3>Asks</h3>
                                    </div>
                                    <filtered-order-list
                                        class="flex-fill"
                                        orders="[[asks]]"
                                        on-order-canceled="_order_canceled"
                                        on-order-accepted="_order_accepted"
                                        display-format="[[orderFormat]]"
                                        limit-num="[[showNBestOrders]]"
                                    ></filtered-order-list>
                                    <div style="margin:auto;">
                                        <div on-input="_updateProposedBundleAsk">
                                        <div class ="pricevolumeinput" style="width: 90%; height: 30;">
                                                <label for="ask_price_input">Price: </label>
                                                <input id="ask_price_input" type="number" min="0" disabled = "[[checkDisabled(running)]]">
                                            </div>
                                            <div class ="pricevolumeinput" style="width:90%">
                                                <label for="ask_volume_input">Qty: </label>
                                                <input id="ask_volume_input" type="number" min="1" disabled = "[[checkDisabled(running)]]">
                                            </div>
                                        </div>
                                        <div>
                                            <button type="button" on-click="_enter_ask" style = "background: #09C206;" disabled="{{!running}}">Ask</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <template is="dom-if" if="{{!showOrderBook}}">
                            <template is="dom-if" if="{{!showTradeDot}}">
                                <div class="list-cell" style="border-radius: 5px; border: 2px solid grey; outline-offset: 0px; align-self: center; width: 250px">
                                    <div class="Title" style= "background-color: grey;">
                                        <h3>Trades
                                        <template is="dom-if" if="{{isFinished}}">
                                            <label for="myCheck" style="box-shadow:none;">Sort Trades:</label> 
                                            <span><input type="checkbox" id="myCheck" autocomplete="off" on-click="sort"></span>
                                        </template>
                                        </h3>
                                    </div>
                                    <filtered-trade-list
                                        class="flex-fill"
                                        trades="[[trades]]"
                                        display-format="[[tradeFormat]]"
                                        limit-num="[[showNMostRecentTrades]]"
                                        show-own-only="[[showOwnTradesOnly]]"
                                        sort-trades="[[sortTrades]]"
                                    ></filtered-trade-list>
                                    
                                </div>
                                <!-- <filtered-trade-list
                                    class="standalone-trade-list"
                                    trades="[[trades]]"
                                    display-format="[[tradeFormat]]"
                                    limit-num="[[showNMostRecentTrades]]"
                                    show-own-only="[[showOwnTradesOnly]]"
                                    sort-trades="[[sortTrades]]"
                                ></filtered-trade-list> -->
                            </template>
                            <template is="dom-if" if="{{showTradeDot}}">
                                <div class="" style="border-radius: 5px; border: 2px solid grey; outline-offset: 0px; align-self: center; width: 500px; height: 450px;flex: 1;
                                    display: flex;
                                    flex-direction: column;">
                                    <trade-dot
                                        class="flex-fill"
                                        trades="[[trades]]"
                                        display-format="[[tradeFormat]]"
                                        limit-num="[[showNMostRecentTrades]]"
                                        show-own-only="[[showOwnTradesOnly]]"
                                        trade-box-scale="[[tradeBoxScale]]"
                                        x-bounds="[[ xBounds ]]"
                                        y-bounds="[[ yBounds ]]"
                                    ></trade-dot>
                                </div>
                            </template>
                        </template>

                        <div class="info-table-and-log" style$="[[ getInfoTableAndLogFlexDirection(showOrderBook) ]]">
                            <div class="info-table">
                                <div class ="Title">Your Allocation</div>

                                <div class ="infoboxcell">
                                    <div class="Heading">
                                        <label for="[[ xToHumanReadable(currentX) ]]">X:</label>
                                        <span>[[ xToHumanReadableRounded(currentX) ]]</span>
                                    </div>
                                </div>

                                <div class="infoboxcell">
                                    <div class="Heading">
                                        <label for="[[ yToHumanReadable(currentY) ]]">Y:</label>
                                        <span>[[ yToHumanReadableRounded(currentY) ]]</span>
                                    </div>
                                </div>

                                <div class="infoboxcell">
                                    <div class="Heading">
                                        <label for="[[ displayUtilityFunction(currentX, currentY) ]]">Utility: </label>
                                        <span>[[ displayUtilityFunction(currentX, currentY) ]]</span>
                                    </div>
                                </div>
                            </div>
                            <div class="log">
                                <event-log id="log"></event-log>
                            </div>
                        </div>
                        
                        <template is="dom-if" if="{{!showOrderBook}}">
                            <div class="standalone-pricevolume">
                                <div>
                                    <div class="pricevolumeinput" style="width: 90%; height: 30;">
                                        <label for="standalone_price_input">Price: </label>
                                        <input id="standalone_price_input" type="number" min="0" readonly>
                                    </div>
                                    <div class="pricevolumeinput" style="width:90%">
                                        <label for="standalone_volume_input">Qty: </label>
                                        <input id="standalone_volume_input" type="number" min="1" readonly>
                                    </div>
                                </div>
                                <div>
                                    <button type="button" on-click="_enterOrderStandalone" disabled="{{!running}}">[[ orderText]]</button>
                                </div>
                            </div>
                        </template>

                    </div>
                    <div class="right-side">
                        <div id="results" style="top:15%;margin-left: 280px;">
                            <div>
                                <span><strong>Final Allocation:</span></strong>
                                <div>
                                    <span>[[ xToHumanReadable(currentX) ]]x &nbsp [[ yToHumanReadable(currentY) ]]y &nbsp [[ displayUtilityFunction(currentX, currentY) ]]&Uscr; </span>
                                </div>
                            </div>
                            <br />
                            <div>
                                <span><strong>Initial Allocation:</span></strong>
                                <div>
                                    <span>[[ xToHumanReadable(initialX) ]]x &nbsp [[ yToHumanReadable(initialY) ]]y &nbsp [[ displayUtilityFunction(initialX, initialY) ]]&Uscr; </span>
                                </div>
                            </div>
                            <br />
                            <div>
                                <span><strong>Gains:</span></strong>
                                <div>
                                    <span> [[ computeGain(initialX, initialY, currentX, currentY) ]]&Uscr; </span>
                                </div>
                            </div>
                        </div>
                        <template is="dom-if" if="{{ heatmapEnabled }}">
                            <div class="heatmap-cell">
                                <heatmap-element
                                    id="heatmap"
                                    utility-function="[[ utilityFunction ]]"
                                    x-bounds="[[ xBounds ]]"
                                    y-bounds="[[ yBounds ]]"
                                    current-x="[[ currentX ]]"
                                    current-y="[[ currentY ]]"
                                    current-bid="[[ currentBid ]]"
                                    current-ask="[[ currentAsk ]]"
                                    bids="[[ bids ]]"
                                    asks="[[ asks ]]"
                                    max-utility="[[ maxUtility ]]"
                                    proposed-x="[[ proposedX ]]"
                                    proposed-y="[[ proposedY ]]"
                                    initial-x="[[ initialXEnd ]]"
                                    initial-y="[[ initialYEnd ]]"
                                    use-partial-equilibrium="[[ usePartialEquilibrium ]]"
                                    show-market-on-heatmap="[[ showMarketOnHeatmap ]]"
                                    on-heatmap-click="onHeatmapClick"
                                    on-order-click="_order_accepted"
                                ></heatmap-element>
                            </div>
                        </template>
                        <template is="dom-if" if="{{ !heatmapEnabled }}">
                            <template is="dom-if" if="{{staticGridEnabled}}">
                                <div class="grid-cell">
                                    <utility-grid
                                        utility-function="[[ utilityFunction ]]"
                                        static-grid-enabled= "[[ staticGridEnabled ]]"
                                        current-x="[[ currentX ]]"
                                        current-y="[[ currentY ]]"
                                        x-bounds="[[ xBounds ]]"
                                        y-bounds="[[ yBounds ]]"
                                    ></utility-grid>
                                </div>
                            </template>
                            <template is="dom-if" if="{{!staticGridEnabled}}">
                                <div class="grid-cell">
                                    <utility-grid
                                        utility-function="[[ utilityFunction ]]"
                                        static-grid-enabled= "[[ staticGridEnabled ]]"
                                        current-x="[[ currentX ]]"
                                        current-y="[[ currentY ]]"
                                        x-bounds="[[ xBounds ]]"
                                        y-bounds="[[ yBounds ]]"
                                    ></utility-grid>
                                </div>
                            </template>
                        </template>
                    </div>
                </div>
            </div>
        `;
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;

        this.orderFormat = order => {
            const price = this.priceToHumanReadable(order.price);
            const volume = this.$.currency_scaler.xToHumanReadable(order.volume);
            return `${volume} @ ${price}`;
        };
        this.tradeFormat = (making_order, taking_order) => {
            const price = this.priceToHumanReadable(making_order.price);
            const volume = this.$.currency_scaler.xToHumanReadable(making_order.traded_volume);
            return `${volume} @ ${price}`;
        };

        for (let bid of this.bids) {
            if (bid.pcode == this.pcode) {
                this.set('currentBid', bid);
            }
        }
        for (let ask of this.asks) {
            if (ask.pcode == this.pcode) {
                this.set('currentAsk', ask);
            }
        }
    }

    computeUtilityFunction(utilityFunctionString) {
        var unscaled_utility = new Function('x', 'y', 'return ' + utilityFunctionString);
        return (x, y) => {
            return unscaled_utility(
                this.$.currency_scaler.xToHumanReadable(x),
                this.$.currency_scaler.yToHumanReadable(y)
            );
        }
    }

    checkDisabled(running){
        if (!this.running || this.disableInputEntry){
            return true
        }
        return false
    }

    computeGain(initialX, initialY, currentX, currentY){
        // computes the gains for each round
        let gain = this.utilityFunction(currentX, currentY) - this.utilityFunction(initialX, initialY);
        return gain.toFixed(2)
        .replace(/\.?0+$/, '');
    }

    sort(event) {
        // if the checkbox is checked then sortTrades should be true,
        // otherwise, it is false
        if (event.target.checked == true){
            this.sortTrades = true
          } else {
            this.sortTrades = false
          }
    }

    onHeatmapClick(e) {
        // this takes some explanation..
        // we need it to be actually possible to move from the current bundle to the proposed one.
        // the restriction is that order prices and volumes have to be integers.
        // so when we calculate the proposed Y, we actually calculate the nearest Y to the click
        // which is an integer multiple of the difference in X between the current X and the proposed X.
        const proposedX = e.detail.x;
        if (proposedX == this.currentX)
            return;

        const xDist = proposedX - this.currentX;
        const proposedY = this.currentY + xDist * Math.round((e.detail.y - this.currentY) / xDist);
        if (proposedY == this.currentY)
            return;

        // if the calculated proposed bundle is in either of the 'impossible' quadrants, just return
        if ((proposedX > this.currentX && proposedY > this.currentY) || (proposedX < this.currentX && proposedY < this.currentY))
            return;

        this.setProperties({
            proposedX: proposedX,
            proposedY: proposedY,
        });

        // the number of decimal points to display for price and volume inputs
        const numVolumeDigits = Math.log10(this.$.currency_scaler.xScale);
        const numPriceDigits = Math.log10(this.$.currency_scaler.yScale / this.$.currency_scaler.xScale);

        // calculate the required trade to move from the current bundle to the proposed one
        if (proposedX > this.currentX) {
            const volume = this.$.currency_scaler.xToHumanReadable(proposedX - this.currentX);
            const price = this.$.currency_scaler.yToHumanReadable(this.currentY - proposedY) / volume;

            this._setBidInput(price.toFixed(numPriceDigits), volume.toFixed(numVolumeDigits));
        }
        else {
            const volume = this.$.currency_scaler.xToHumanReadable(this.currentX - proposedX);
            const price = this.$.currency_scaler.yToHumanReadable(proposedY - this.currentY) / volume;

            this._setAskInput(price.toFixed(numPriceDigits), volume.toFixed(numVolumeDigits));
        }
    }

    _setBidInput(price, volume) {
        if (this.showOrderBook ) {
            this.getByIdDynamic('bid_volume_input').value = volume;
            this.getByIdDynamic('bid_price_input').value = price;
            
            this.getByIdDynamic('ask_volume_input').value = '';
            this.getByIdDynamic('ask_price_input').value = '';
        }
        else {
            this.standaloneOrderIsBid = true;
            this.orderText = 'ENTER BID';
            this._setStandalonePriceInput(price, volume);
        }
    }

    _setAskInput(price, volume) {
        if (this.showOrderBook ) {
            this.getByIdDynamic('ask_volume_input').value = volume;
            this.getByIdDynamic('ask_price_input').value = price;

            this.getByIdDynamic('bid_volume_input').value = '';
            this.getByIdDynamic('bid_price_input').value = '';
        }
        else {
            this.standaloneOrderIsBid = false;
            this.orderText = 'ENTER ASK';
            this._setStandalonePriceInput(price, volume);
        }
    }

    _setStandalonePriceInput(price, volume) {
        this.getByIdDynamic('standalone_volume_input').value = volume;
        this.getByIdDynamic('standalone_price_input').value = price;
    }

    _enterOrderStandalone() {
        if (typeof this.standaloneOrderIsBid === 'undefined') return;

        let price = parseFloat(this.getByIdDynamic('standalone_price_input').value);
        price = this.priceFromHumanReadable(price);
        if (isNaN(price) || price < 0) {
            this.$.log.error('Can\'t enter order: invalid price');
            return;
        }

        let volume = parseFloat(this.getByIdDynamic('standalone_volume_input').value);
        volume = this.$.currency_scaler.xFromHumanReadable(volume);
        if (isNaN(volume) || volume < 0) {
            this.$.log.error('Can\'t enter order: invalid volume');
            return;
        }

        this.$.trader_state.enter_order(price, volume, this.standaloneOrderIsBid);
        
        this.setProperties({
            proposedX: null,
            proposedY: null,
        });
    }

    _updateProposedBundleBid() {
        let price = parseFloat(this.getByIdDynamic('bid_price_input').value);
        price = this.priceFromHumanReadable(price);
        let volume = parseFloat(this.getByIdDynamic('bid_volume_input').value);
        volume = this.$.currency_scaler.xFromHumanReadable(volume);

        if (isNaN(price) || price < 0 || isNaN(volume) || volume < 0) {
            this.setProperties({
                proposedX: null,
                proposedY: null,
            })
            return;
        }
        
        this.setProperties({
            proposedX: this.currentX + volume,
            proposedY: this.currentY - price * volume,
        });
    }

    _updateProposedBundleAsk() {
        let price = parseFloat(this.getByIdDynamic('ask_price_input').value);
        price = this.priceFromHumanReadable(price);
        let volume = parseFloat(this.getByIdDynamic('ask_volume_input').value);
        volume = this.$.currency_scaler.xFromHumanReadable(volume);
        if (isNaN(price) || price < 0 || isNaN(volume) || volume < 0) {
            this.setProperties({
                proposedX: null,
                proposedY: null,
            })
            return;
        }
        
        this.setProperties({
            proposedX: this.currentX - volume,
            proposedY: this.currentY + price * volume,
        });
    }

    _enter_bid() {
        let price = parseFloat(this.getByIdDynamic('bid_price_input').value);
        price = this.priceFromHumanReadable(price);
        if (isNaN(price) || price < 0) {
            this.$.log.error('Can\'t enter bid: invalid price');
            return;
        }

        let volume = parseFloat(this.getByIdDynamic('bid_volume_input').value);
        volume = this.$.currency_scaler.xFromHumanReadable(volume);
        if (isNaN(volume) || volume < 0) {
            this.$.log.error('Can\'t enter bid: invalid volume');
            return;
        }

        this.$.trader_state.enter_order(price, volume, true);

        this.setProperties({
            proposedX: null,
            proposedY: null,
        });
    }

    _enter_ask() {
        let price = parseFloat(this.getByIdDynamic('ask_price_input').value);
        price = this.priceFromHumanReadable(price);
        if (isNaN(price) || price < 0) {
            this.$.log.error('Can\'t enter ask: invalid price');
            return;
        }

        let volume = parseFloat(this.getByIdDynamic('ask_volume_input').value);
        volume = this.$.currency_scaler.xFromHumanReadable(volume);
        if (isNaN(volume) || volume < 0) {
            this.$.log.error('Can\'t enter ask: invalid volume');
            return;
        }

        this.$.trader_state.enter_order(price, volume, false);

        this.setProperties({
            proposedX: null,
            proposedY: null,
        });
    }

    // triggered when this player cancels an order
    _order_canceled(event) {
        const order = event.detail;

        this.$.modal.modal_text = 'Are you sure you want to remove this order?';
        this.$.modal.buttons = ['No', 'Yes'];
        this.$.modal.on_close_callback = (button_index) => {
            if (button_index == 1)
                this.$.trader_state.cancel_order(order);
        };
        this.$.modal.show();
    }

    // triggered when this player accepts someone else's order
    _order_accepted(event) {
        const order = event.detail;
        if (order.pcode == this.pcode)
            return;

        const price = this.priceToHumanReadable(order.price);
        const volume = this.$.currency_scaler.xToHumanReadable(order.volume);

        this.$.modal.modal_text = `Do you want to ${order.is_bid ? 'sell' : 'buy'} ${volume} units for ${price}?`
        this.$.modal.buttons = ['No', 'Yes'];
        this.$.modal.on_close_callback = (button_index) => {
            if (button_index == 1)
                this.$.trader_state.accept_order(order);
        };
        this.$.modal.show();
    }

    _onError(event) {
        let message = event.detail;
        // we either die heroes or live long enough to see ourselves become villains
        message = message.replace('cash', 'goods');
        this.$.log.error(message);
    }

    _confirmOrderEntered(event) {
        const order = event.detail;
        if (order.pcode == this.pcode) {
            if (order.is_bid) {
                this.set('currentBid', order);
            }
            else {
                this.set('currentAsk', order);
            }
        }
    }

    _confirmOrderCanceled(event) {
        const order = event.detail;
        if (order.pcode == this.pcode) {
            if (order.is_bid) {
                this.set('currentBid', null);
            }
            else {
                this.set('currentAsk', null);
            }
        }
    }

    _confirmTrade(event) {
        console.log(this.$.trader_state.bids);
        console.log(this.bids);
        console.log(this.$.trader_state.asks);
        console.log(this.asks);
        const trade = event.detail;
        for (const order of trade.making_orders.concat([trade.taking_order])) {
            if (order.pcode == this.pcode) {
                console.log(order.volume);
                order.volume -= order.traded_volume;
                console.log(order.volume)
                if (order.is_bid) {
                    if (order.volume == 0)
                        this.set('currentBid', null);
                    else
                        this.set('currentBid', order);
                }
                else {
                    if (order.volume == 0)
                        this.set('currentAsk', null);
                    else
                        this.set('currentAsk', order);
                }
            }
        }
    }

    _periodEnd(_event) {
        this.$.results.style.display = "initial";
        this.isFinished = true;
        this.setProperties({
            initialXEnd: this.initialX,
            initialYEnd: this.initialY,
        });
    }

    xToHumanReadable(a) {
        return this.$.currency_scaler.xToHumanReadable(a);
    }
    yToHumanReadable(a) {
        return this.$.currency_scaler.yToHumanReadable(a);
    }

    roundToTwo(num) {    
        return +(Math.round(num + "e+2")  + "e-2");
    }
    xToHumanReadableRounded(a) {
        return this.roundToTwo(this.$.currency_scaler.xToHumanReadable(a));
    }
    yToHumanReadableRounded(a) {
        return this.roundToTwo(this.$.currency_scaler.yToHumanReadable(a));
    }

    displayUtilityFunction(x, y) {
        // return a string with the utility value for x and y, with a maximum of 2 decimal points
        return this.utilityFunction(x, y)
            .toFixed(2)
            .replace(/\.?0+$/, '');
    }
    formatTimeRemaining(timeRemaining) {
        const minutes = Math.floor(timeRemaining/60);
        let seconds = '' + timeRemaining%60;
        if (seconds.length == 1) seconds = '0' + seconds;
        return `${minutes}:${seconds}`;
    }
    priceToHumanReadable(price) {
        // price is in units Y per unit X, so scaling has to respect that
        const factor = this.$.currency_scaler.yScale / this.$.currency_scaler.xScale;
        return price / factor;
    }
    priceFromHumanReadable(price) {
        // price is in units Y per unit X, so scaling has to respect that
        const factor = this.$.currency_scaler.yScale / this.$.currency_scaler.xScale;
        return Math.round(price * factor);
    }
    roundNumber() {
        return this.$.constants.roundNumber;
    }
    // get a dynamically generated node by its id
    // dynamically generated nodes include anything inside a dom-if or dom-repeat tag
    // this effectively does the same thing as this.$.id, but it works for stuff inside these dynamic tags
    getByIdDynamic(id) {
        return this.shadowRoot.querySelector('#' + id);
    }
    getInfoTableAndLogFlexDirection(showOrderBook) {
        return showOrderBook ? '' : 'flex-direction: column;';
    }
}

window.customElements.define('visual-markets', VisualMarkets);
