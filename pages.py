from otree_markets.pages import BaseMarketPage

class Market(BaseMarketPage):

    def is_displayed(self):
        return self.round_number <= self.subsession.config.num_rounds
    
    def vars_for_template(self):
        config = self.subsession.config
        x_bounds = [x * config.x_currency_scale for x in config.x_bounds]
        y_bounds = [y * config.y_currency_scale for y in config.y_bounds]

        return {
            'config': config,
            'x_bounds': x_bounds,
            'y_bounds': y_bounds,
        }

page_sequence = [Market]
