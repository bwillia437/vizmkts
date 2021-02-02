
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
                .bid {
                    background-color: #ffb3b3;
                }
                .ask {
                    background-color: #c6ffb3;
                }
            </style>

            <otree-constants
                id="constants"
            ></otree-constants>

            <div id="container">
                <template is="dom-repeat" items="{{ filterTrades(trades.*, limitNum, showOwnOnly) }}" as="trade" filter="{{_getAssetFilterFunc(assetName)}}">
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

    getCellClass(making, taking) {
        if (this.pcode == taking.pcode){
            if (taking.is_bid) {
                return 'bid'
            } else{
                return 'ask'
            }
        }
        if (this.pcode == making.pcode){
            if (making.is_bid){
                return 'bid'
            } else{
                return 'ask'
            }
        }

    }         

    filterTrades(tradesChange, limitNum, showOwnOnly) {
        // given a trade, return true if the current player participated in that trade
        const player_participated = trade => {
            return trade.taking_order.pcode == this.pcode || trade.making_orders.some(order => order.pcode == this.pcode);
        };

        const trades = tradesChange.base;
        if (typeof trades === 'undefined') return;

        const filtered_trades = [];
        for (const trade of trades) {
            if (showOwnOnly && !player_participated(trade)) continue;
            filtered_trades.push(trade);
            if (limitNum > 0 && filtered_trades.length >= limitNum) break;
        }
        return filtered_trades
    }

}

window.customElements.define('filtered-trade-list', FilteredTradeList);