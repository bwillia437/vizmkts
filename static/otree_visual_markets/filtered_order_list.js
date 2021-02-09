
import { html } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { OrderList } from '/static/otree_markets/order_list.js';

class FilteredOrderList extends OrderList {

    static get properties() {
        return {
            limitNum: {
                type: Number,
                value: 0,
            },
        }
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
                #container > div {
                    position: relative;
                    border: 1px solid black;
                    text-align: center;
                    margin: 3px;
                    cursor: default;
                    user-select: none;
                }
                .cancel-button {
                    position: absolute;
                    color: red;
                    line-height: 0.85;
                    height: 100%;
                    right: 10px;
                    font-size: 150%;
                    cursor: pointer;
                    user-select: none;
                }
                .other-order .cancel-button {
                    display: none;
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
                <template is="dom-repeat" items="{{ filterOrders(orders.*, limitNum) }}" filter="{{_getAssetFilterFunc(assetName)}}">
                    <div on-dblclick="_acceptOrder" class$="[[ getCellClass(orders) ]]">
                        <span>[[displayFormat(item)]]</span>
                        <span class="cancel-button" on-click="_cancelOrder">&#9746;</span>
                    </div>
                </template>
            </div>
        `;
    }

    getCellClass(orders){
        if (this.pcode == orders[0].pcode){
            if (orders[0].is_bid){
                return 'bid'
            } else {
                return 'ask'
            }
        }
        return ''

    }

    filterOrders(ordersChange, limitNum) {
        const orders = ordersChange.base;
        if (typeof orders === 'undefined') return;

        return orders.filter((order, i) => {
            return order.pcode == this.pcode || limitNum == 0 || i < limitNum;
        });
    }

}

window.customElements.define('filtered-order-list', FilteredOrderList);