
import { html } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { TradeList } from '/static/otree_markets/trade_list.js';

import '/static/otree-redwood/src/otree-constants/otree-constants.js';

//import '../highcharts.js'; 

class TradeDot extends TradeList {
    static get observers() {
        return [
          // Observer method name, followed by a list of dependencies, in parenthesis
          '_updateDataset(trades.*, limitNum, showOwnOnly)'
        ]
      }

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
            tradeBoxScale: {
                type: Number,
                value: 0,
            },
            xBounds: Array,
            yBounds: Array,
        };
    }

    static get template() {
        return html`
        <style>
            :host {
                display: block;
            }
        </style>

            <otree-constants
                id="constants"
            ></otree-constants>
            <div id="chart" style="width: 100%;height: 100%;flex: 1;
            display: flex;
            flex-direction: column;"></div>
        `;
    }

    ready() {
        super.ready();
        this.pcode = this.$.constants.participantCode;
        setTimeout(this._initHighchart.bind(this), 1);
    }

    _initHighchart() {
        // call highcharts setup function
        this.graph_obj = Highcharts.chart({
            chart: {
                animation: false,
                renderTo: this.$.chart,
                enabled: false,
                width: this.offsetWidth,
                height: this.offsetHeight,

            },
            title: {
                text: 'Trades',
             },
             
             tooltip: { enabled: false },
         
         
             legend: {
                 enabled: false,
                 layout: 'vertical',
                 align: 'right',
                 verticalAlign: 'middle'
             },
         
             plotOptions: {
                 series: {
                     label: {
                         connectorAllowed: false,
                         enabled: false
                     },
                     pointStart: 0,
                     marker: {
                        enabled: false
                     }
                 }
             },
         
             
         
             responsive: {
                 rules: [{
                     condition: {
                         maxWidth: 1
                     },
                     chartOptions: {
                         legend: {
                                 enabled: false,
                             layout: 'horizontal',
                             align: 'center',
                             verticalAlign: 'bottom'
                         }
                     }
                 }]
             },

            credits: { enabled: false },
            yAxis: {
                min: (- (this.tradeBoxScale * (this.yBounds[1] - this.yBounds[0])) / 2) / 1000,
                max:  ((this.tradeBoxScale * (this.yBounds[1] - this.yBounds[0])) / 2) / 1000,
                title: {
                    text: undefined
                },
                labels: {
                    enabled: false
                },
                gridLineWidth: 0,
                minorGridLineWidth: 0
            },
            
        
        
            xAxis: {
                min: (- (this.tradeBoxScale * (this.xBounds[1] - this.xBounds[0])) / 2) / 10,
                max:  ((this.tradeBoxScale * (this.xBounds[1] - this.xBounds[0])) / 2) / 10,
                accessibility: {
                    rangeDescription: 'X axis'
                },
                labels: {
                    enabled: false
                },
                gridLineWidth: 0,
                minorGridLineWidth: 0,
                visible: false
            },
            series: [
                {
                    type: 'scatter',
                    color: '#000000',
                    data: [[0, 0]],
                    marker: {
                        enabled: true,
                        radius: 7
                    },
                    enableMouseTracking: false
                }
            ],
            
        });
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

    filterTrades(tradesChange, limitNum, showOwnOnly, sortTrades) {
        const trades = tradesChange.base;
        if (typeof trades === 'undefined') return;

        const transactions = [];
        let i = 0;
        for (let trade of trades) {
            for (let making_order of trade.making_orders) {
                if (making_order.pcode == this.pcode ||
                    trade.taking_order.pcode == this.pcode ||
                    ((!showOwnOnly && (limitNum == 0 || i < limitNum)))) {

                    transactions.push({
                        making_order: making_order,
                        taking_order: trade.taking_order,
                    });
                }
                i++;
            }
        }

        // if sortTrades is true, sort the trades by price in decreasing order
        if (sortTrades){
            transactions.sort((a, b) => {
                return b.making_order.price - a.making_order.price;
            });
        }
        return transactions;
    }

    _updateDataset(tradesChange, limitNum, showOwnOnly) {
        const trades = tradesChange.base;
        if (typeof trades === 'undefined') return;
        
        // if graph hasn't been initialized, don't do anything
        if (!this.graph_obj) return;

        while( this.graph_obj.series.length > 0 ) {
            this.graph_obj.series[0].remove( false );
        }
        
        this.graph_obj.addSeries({
            type: 'scatter',
            color: '#000000',
            data: [[0, 0]],
            marker: {
                enabled: true,
                radius: 7
            },
            enableMouseTracking: false
        }, false);

        let i = 0;
        for (let trade of trades) {
            for (let making_order of trade.making_orders) {

                if (making_order.pcode == this.pcode ||
                    trade.taking_order.pcode == this.pcode ||
                    ((!showOwnOnly && (limitNum == 0 || i < limitNum)))) {

                    //let slope = - making_order.price;
                    //let length = making_order.traded_volume;

                    // Default to black when player is not involved in trade 
                    let left_color = '#000000';
                    let right_color = '#000000';
                    
                    if (making_order.pcode == this.pcode){
                        if (making_order.is_bid){
                            right_color = '#FF0000';
                        } else {
                            left_color = '#00FF00';
                        }
                    } else if(trade.taking_order.pcode == this.pcode){
                        if (trade.taking_order.is_bid){
                            right_color = '#FF0000';
                        } else {
                            left_color = '#00FF00';
                        }
                    }
                    // d = distance
                    // m = slope

                    // x = d / sqrt(1 + m^2)
                    //let x = (length/2) / (Math.sqrt(1 + Math.pow(slope,2)));

                    // y = dm / sqrt(1 + m^2)
                    // let y = ((length * slope)/2) / (Math.sqrt(1 + Math.pow(slope,2)));

                    let x = making_order.traded_volume / 10;
                    let y = - (making_order.traded_volume / 10) * (making_order.price / 100);

    
                    this.graph_obj.addSeries({
                        color: right_color,
                        data: [[x, y], [0, 0]],
                        enableMouseTracking: false
                    }, false);
                    this.graph_obj.addSeries({
                        color: left_color,
                        data: [[0, 0], [-x, -y]],
                        enableMouseTracking: false
                    }, false);
                }
                i++;
            }
        }
        this.graph_obj.redraw();

        
    }
}

window.customElements.define('trade-dot', TradeDot);