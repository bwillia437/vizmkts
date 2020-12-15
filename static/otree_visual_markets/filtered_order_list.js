
import { html } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { OrderList } from '/static/otree_markets/order_list.js';

class FilteredOrderList extends OrderList {

    static get properties() {
        return {
            limitNum: {
                type: Number,
                value: null,
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
            </style>

            <otree-constants
                id="constants"
            ></otree-constants>

            <div id="container">
                <template is="dom-repeat" items="{{ limitOrders(orders.*, limitNum) }}" filter="{{_getAssetFilterFunc(assetName)}}">
                    <div on-dblclick="_acceptOrder" class$="[[_getOrderClass(item)]]">
                        <span>[[displayFormat(item)]]</span>
                        <span class="cancel-button" on-click="_cancelOrder">&#9746;</span>
                    </div>
                </template>
            </div>
        `;
    }

    limitOrders(ordersChange, limitNum) {
        const orders = ordersChange.base;
        if (typeof orders === 'undefined') return;

        if (limitNum == 0) return orders.slice();
        return orders.filter((order, i) => {
            return (order.pcode == this.pcode || i < limitNum);
        });
    }

}

window.customElements.define('filtered-order-list', FilteredOrderList);