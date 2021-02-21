
import { html } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { TradeList } from '/static/otree_markets/trade_list.js';

import '/static/otree-redwood/src/otree-constants/otree-constants.js';

class FilteredTradeList extends TradeList {

    static get properties() {
        return {
            limitNum: {
                type: Number,
                value: 0,
            },
            showOwnOnly: {
                type: Boolean,
                value: false,
            },
            sortTrades: {
                type: Boolean,
                value: false,
            }
        };
    }

    static get template() {
        return html`
            <style>
                #container {
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    box-sizing: border-box;
                }
                #container div {
                    border: 1px solid black;
                    text-align: center;
                    margin: 3px;
                }
                .my-bid {
                    background-color: #ffb3b3;
                }
                .my-ask {
                    background-color: #c6ffb3;
                }
            </style>

            <otree-constants
                id="constants"
            ></otree-constants>
            <redwood-period
                on-period-end="_periodEnd"
                running="{{running}}"
            ></redwood-period>

            <div id="container">
                <template is="dom-repeat" items="{{ filterTrades(trades.*, limitNum, showOwnOnly, sortTrades) }}" as="trade" filter="{{_getAssetFilterFunc(assetName)}}">
                    <template is="dom-repeat" items="{{trade.making_orders}}" as="making_order">
                        <div class$="[[ getCellClass(making_order, trade.taking_order) ]]">
                            <span>[[displayFormat(making_order, trade.taking_order)]]</span>
                        </div>
                    </template>
                </template>
            </div>
        `;
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;
    }

    _periodEnd(_event) {
        this.$.results.style.display = "initial";
    }
    getCellClass(making, taking) {
        if (this.pcode == taking.pcode){
            if (taking.is_bid) {
                return 'my-bid'
            } else{
                return 'my-ask'
            }
        }
        if (this.pcode == making.pcode){
            if (making.is_bid){
                return 'my-bid'
            } else{
                return 'my-ask'
            }
        }
    }         

    filterTrades(tradesChange, limitNum, showOwnOnly, sortTrades) { // pass in sortTrade boolean



        // given a trade, return true if the current player participated in that trade
        const player_participated = trade => {
            return trade.taking_order.pcode == this.pcode || trade.making_orders.some(order => order.pcode == this.pcode);
        };

        const trades = tradesChange.base;
        if (typeof trades === 'undefined') return;

        // return trades.filter((trade, i) => { // insert code somewhere here
        //     return player_participated(trade) || limitNum == 0 || i < limitNum;

        // if the boolean variable, sortTrades if false, then only filter trades according to the round's rules
        // if sortTrades is true, then filter the trades according to the rounds rules AND sort the trades by
        // price in decreasing order
        if (sortTrades == false){
            return trades.filter((trade, i) => { // insert code somewhere here
                return player_participated(trade) || limitNum == 0 || i < limitNum;
            });
        } else {
            const tradesToSort = trades.filter((trade,i) => {
                return player_participated(trade) || limitNum == 0 || i < limitNum;
            });
            return tradesToSort.sort((a, b) => {
                return b.taking_order.price - a.taking_order.price;
            });
        }

        
    }

}

window.customElements.define('filtered-trade-list', FilteredTradeList);