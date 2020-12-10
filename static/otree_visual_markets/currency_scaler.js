import { PolymerElement } from '/static/otree-redwood/node_modules/@polymer/polymer/polymer-element.js';

let _xScale = 1;
let _yScale = 1;

class CurrencyScaler extends PolymerElement {

    ready() {
        super.ready();
        if (this.hasAttribute('x-scale'))
            _xScale = parseInt(this.getAttribute('x-scale'));
        if (this.hasAttribute('y-scale'))
            _yScale = parseInt(this.getAttribute('y-scale'));
    }

    get xScale() {
        return _xScale;
    }

    get yScale() {
        return _yScale
    }

    xToHumanReadable(a) {
        return a / this.xScale;
    }

    xFromHumanReadable(a) {
        return Math.round(a * this.xScale);
    }

    yToHumanReadable(a) {
        return a / this.yScale;
    }

    yFromHumanReadable(a) {
        return Math.round(a * this.yScale);
    }
}

window.customElements.define('currency-scaler', CurrencyScaler);