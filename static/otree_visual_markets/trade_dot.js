
import { html } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';
import { TradeList } from '/static/otree_markets/trade_list.js';

import '/static/otree-redwood/src/otree-constants/otree-constants.js';

//import '../highcharts.js'; 

class TradeDot extends TradeList {
    static get observers() {
        return [
          // Observer method name, followed by a list of dependencies, in parenthesis
          '_updateDataset(trades.*)'
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
            }
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

            <div id="chart"></div>
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
                title: {
                    text: undefined
                },
                labels: {
                    enabled: true
                }
            },
            
        
        
            xAxis: {
                //min: -10,
                //max: 10,
                accessibility: {
                    rangeDescription: 'X axis'
                },
                labels: {
                    enabled: true
                }
            },
            series: [
                {
                    type: 'scatter',
                    color: '#000000',
                    data: [[0, 0]],
                    marker: {
                        enabled: true,
                        radius: 7
                    }
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

    _updateDataset(tradesChange) {
        console.log("update");
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
            }
        }, false);

        let i = 0;
        for (let trade of trades) {
            for (let making_order of trade.making_orders) {

                if (making_order.pcode == this.pcode ||
                    trade.taking_order.pcode == this.pcode ||
                    ((!showOwnOnly && (limitNum == 0 || i < limitNum)))) {

                    let slope = - making_order.price;
                    let length = making_order.traded_volume;

                    // Default to black when player is not involved in trade 
                    let graph_color = '#000000';
                    
                    if (making_order.pcode == this.pcode){
                        if (making_order.is_bid){
                            graph_color = '#FF0000';
                        } else {
                            graph_color = '#00FF00';
                        }
                    } else if(trade.taking_order.pcode == this.pcode){
                        if (trade.taking_order.is_bid){
                            graph_color = '#FF0000';
                        } else {
                            graph_color = '#00FF00';
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

    
                    console.log(making_order);
                    console.log(x);
                    console.log(y);
                    this.graph_obj.addSeries({
                        color: graph_color,
                        data: [[x, y], [-x, -y]]
                    }, false);
                }
                i++;
            }
        }
        this.graph_obj.redraw();

        
    }
}

window.customElements.define('trade-dot', TradeDot);